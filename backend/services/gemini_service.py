import json
import re
import asyncio
from typing import List, Dict, Optional
from groq import Groq
from config import settings

client = Groq(api_key=settings.GROQ_API_KEY)
MODEL = settings.GROQ_MODEL


def _call_sync(prompt: str, retries: int = 3) -> str:
    """Call Groq synchronously with retry on rate limit."""
    for attempt in range(retries):
        try:
            response = client.chat.completions.create(
                model=MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "rate_limit" in err_str.lower():
                wait = 10 * (attempt + 1)
                print(f"[groq] rate limited, waiting {wait}s (attempt {attempt+1}/{retries})")
                import time; time.sleep(wait)
                if attempt == retries - 1:
                    raise Exception(f"Groq rate limit after {retries} retries: {e}")
            else:
                raise Exception(f"Groq error: {e}")


async def _call(prompt: str, retries: int = 3) -> str:
    """Async wrapper around sync Groq call."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _call_sync(prompt, retries))


def _clean_json(text: str):
    """Strip markdown fences and parse JSON robustly."""
    text = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    m = re.search(r'\[[\s\S]*\]', text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    m = re.search(r'\{[\s\S]*\}', text)
    if m:
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            pass
    raise ValueError(f"No valid JSON in: {text[:300]}")


# Dynamic time limits (seconds) per difficulty level
TIME_LIMITS = {
    "easy": 45,
    "medium": 60,
    "hard": 90,
    "scenario": 120,
}


class GeminiService:

    # ------------------------------------------------------------------ #
    #  SINGLE PARSE CALL — skills + experience + JD context in one shot  #
    # ------------------------------------------------------------------ #
    async def parse_documents(self, resume_text: str, jd_text: str = "") -> Dict:
        """
        One Groq call on upload. Reads the full resume + full JD and returns:
          - skills list
          - candidate level / years / role (from resume)
          - JD required years, responsibilities, must-haves (from JD)
        This replaces the old separate extract_skills + extract_experience calls.
        """
        combined = f"RESUME:\n{resume_text}"
        if jd_text:
            combined += f"\n\nJOB DESCRIPTION:\n{jd_text}"
        print(f"[parse_documents] resume={len(resume_text)} chars, jd={len(jd_text)} chars")

        prompt = f"""You are a technical recruiter. Read the full resume and job description below and extract everything in one pass.

{combined}

Return ONLY this JSON (no markdown, no extra text):
{{
  "skills": ["<every tech skill, tool, framework, platform from both documents>"],
  "years_experience": <total years from resume work history, number or null>,
  "level": "<junior|mid|senior|lead|principal — infer from years + job titles>",
  "role": "<candidate primary role title>",
  "jd_required_years": <years required by JD, number or null>,
  "jd_responsibilities": ["<up to 6 key responsibilities from JD>"],
  "jd_must_have": ["<up to 6 must-have qualifications from JD>"]
}}"""

        raw = ""
        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, dict) and "skills" in result:
                skills = [s.strip() for s in result.get("skills", []) if isinstance(s, str) and s.strip()]
                print(f"[parse_documents] skills={len(skills)}, level={result.get('level')}, years={result.get('years_experience')}, jd_resp={len(result.get('jd_responsibilities', []))}")
                return {
                    "skills": skills[:25],
                    "years_experience": result.get("years_experience"),
                    "level": result.get("level", "mid"),
                    "role": result.get("role", "Software Engineer"),
                    "jd_required_years": result.get("jd_required_years"),
                    "jd_responsibilities": result.get("jd_responsibilities", []),
                    "jd_must_have": result.get("jd_must_have", []),
                }
        except Exception as e:
            print(f"[parse_documents] failed: {e} | raw: {raw[:200]}")

        # Fallback: keyword scan
        candidates = [
            "PowerApps", "Power Automate", "Power BI", "SharePoint", "Dataverse",
            "Azure AD", "Azure", "Microsoft 365", "Dynamics 365",
            "SQL", "Python", "JavaScript", "TypeScript", "Java", "React", "Node.js",
            "Docker", "Kubernetes", "AWS", "GCP", "Terraform", "Git",
            "REST", "GraphQL", "MongoDB", "PostgreSQL", "MySQL", "Redis",
            "Django", "Flask", "FastAPI", "Spring Boot", "Angular", "Vue",
            "LangChain", "OpenAI", "Qdrant", "D3.js", "Redux", "Pydantic"
        ]
        text_lower = (resume_text + " " + jd_text).lower()
        found = [s for s in candidates if s.lower() in text_lower]
        return {
            "skills": found[:20] or ["General Technical Skills"],
            "years_experience": None, "level": "mid", "role": "Software Engineer",
            "jd_required_years": None, "jd_responsibilities": [], "jd_must_have": [],
        }

    # ------------------------------------------------------------------ #
    #  QUESTION GENERATION  (resume + JD aware, with time limits)         #
    # ------------------------------------------------------------------ #
    async def generate_questions(
        self,
        resume_text: str,
        skills: List[str],
        total_questions: int = 5,
        jd_text: str = "",
        experience_info: Optional[Dict] = None
    ) -> List[Dict]:
        """Returns list of {question, difficulty, time_limit} dicts."""
        skills_list = "\n".join(f"- {s}" for s in skills[:20])
        level = (experience_info or {}).get("level", "mid")
        role = (experience_info or {}).get("role", "Software Engineer")
        years = (experience_info or {}).get("years_experience", "unknown")
        jd_responsibilities = (experience_info or {}).get("jd_responsibilities", [])
        jd_must_have = (experience_info or {}).get("jd_must_have", [])

        jd_section = ""
        if jd_text:
            jd_section = f"\nJob Description (full):\n{jd_text}"
            if jd_responsibilities:
                jd_section += "\n\nKey JD Responsibilities:\n" + "\n".join(f"- {r}" for r in jd_responsibilities)
            if jd_must_have:
                jd_section += "\n\nJD Must-Have Qualifications:\n" + "\n".join(f"- {q}" for q in jd_must_have)

        print(f"[generate_questions] resume={len(resume_text)} chars, jd={len(jd_text)} chars, level={level}, skills={len(skills)}")

        prompt = f"""You are a senior technical interviewer. Generate exactly {total_questions} interview questions for this candidate.

Candidate Level: {level} ({years} years experience)
Target Role: {role}
Key Skills: {skills_list}

Full Resume:
{resume_text}
{jd_section}

RULES:
1. Every question MUST reference something specific from the resume OR directly test a JD requirement/responsibility.
2. If a JD is provided, at least 2 questions must test whether the candidate meets the JD's key responsibilities or must-have qualifications.
3. Spread questions across DIFFERENT skills — no repeats.
4. Assign a difficulty: "easy" (conceptual), "medium" (applied), "hard" (deep technical), "scenario" (design/architecture).
5. Calibrate difficulty to the candidate's level ({level}): senior candidates get more hard/scenario questions.
6. Each question must be specific enough that only this candidate can answer it well.

Return ONLY a raw JSON array of exactly {total_questions} objects:
[
  {{
    "question": "<the interview question>",
    "difficulty": "<easy|medium|hard|scenario>",
    "topic": "<main topic>"
  }},
  ...
]
No markdown, no extra text."""

        raw = ""
        try:
            raw = await _call(prompt)
            print(f"[generate_questions] raw (600): {raw[:600]}")
            result = _clean_json(raw)
            if isinstance(result, list):
                questions = []
                for item in result:
                    if isinstance(item, dict) and len(item.get("question", "").strip()) > 20:
                        diff = item.get("difficulty", "medium")
                        questions.append({
                            "question": item["question"].strip(),
                            "difficulty": diff,
                            "topic": item.get("topic", "General"),
                            "time_limit": TIME_LIMITS.get(diff, 60)
                        })
                if len(questions) >= total_questions:
                    return questions[:total_questions]
                if questions:
                    return await self._fill_remaining_dicts(questions, resume_text, jd_text, skills, total_questions, level)
        except Exception as e:
            print(f"[generate_questions] failed: {e} | raw: {raw[:300]}")

        return await self._generate_individually_dicts(resume_text, jd_text, skills, total_questions, level)

    async def _fill_remaining_dicts(self, existing, resume_text, jd_text, skills, total, level):
        covered = {s.lower() for q in existing for s in skills if s.lower() in q["question"].lower()}
        uncovered = [s for s in skills if s.lower() not in covered] or skills
        for i in range(total - len(existing)):
            skill = uncovered[i % len(uncovered)]
            q = await self._single_question_dict(resume_text, jd_text, skill, existing, level)
            existing.append(q)
        return existing

    async def _generate_individually_dicts(self, resume_text, jd_text, skills, total, level):
        questions = []
        used = []
        for i in range(total):
            skill = next((s for s in skills if s not in used), skills[i % len(skills)])
            used.append(skill)
            q = await self._single_question_dict(resume_text, jd_text, skill, questions, level)
            questions.append(q)
        return questions

    async def _single_question_dict(self, resume_text, jd_text, skill, previous, level):
        prev_str = "\n".join(f"- {q['question']}" for q in previous) if previous else "None"
        jd_section = f"\nJob Description:\n{jd_text}" if jd_text else ""
        diff = "hard" if level in ("senior", "lead", "principal") and len(previous) > 1 else "medium"

        prompt = f"""Generate ONE specific interview question about {skill} for a {level}-level candidate.
The question must reference something concrete from the resume or JD requirements.
Do NOT repeat: {prev_str}

Resume: {resume_text}
{jd_section}

Return ONLY this JSON:
{{"question": "<the question>", "difficulty": "{diff}", "topic": "{skill}"}}"""

        try:
            raw = (await _call(prompt)).strip()
            result = _clean_json(raw)
            if isinstance(result, dict) and len(result.get("question", "")) > 20:
                d = result.get("difficulty", diff)
                return {
                    "question": result["question"],
                    "difficulty": d,
                    "topic": result.get("topic", skill),
                    "time_limit": TIME_LIMITS.get(d, 60)
                }
        except Exception as e:
            print(f"[_single_question_dict] failed for {skill}: {e}")

        return {
            "question": f"Describe a specific project where you used {skill} and the key technical decisions you made.",
            "difficulty": diff,
            "topic": skill,
            "time_limit": TIME_LIMITS.get(diff, 60)
        }

    # ------------------------------------------------------------------ #
    #  BATCH ANSWER EVALUATION                                             #
    # ------------------------------------------------------------------ #
    async def evaluate_all_answers(self, qa_history: List[Dict], resume_text: str) -> List[Dict]:
        qa_block = "\n\n".join([
            f"Q{i+1}: {qa['question']}\nAnswer: {qa['answer']}"
            for i, qa in enumerate(qa_history)
        ])

        prompt = f"""You are a strict technical interviewer evaluating a candidate's full interview.

Candidate Resume:
{resume_text}

{len(qa_history)} Q&A pairs:
{qa_block}

Score each answer 0–10:
0 — No answer / gibberish
1-2 — Wrong, no understanding
3-4 — Vague, surface-level
5-6 — Partially correct, missing depth
7-8 — Good, technically sound
9-10 — Excellent, detailed, hands-on

Return ONLY a JSON array of exactly {len(qa_history)} objects:
[
  {{
    "index": 0,
    "score": <0-10>,
    "feedback": "<2-3 sentences>",
    "topic": "<topic>",
    "strengths": ["<strength>"],
    "improvements": ["<improvement>"]
  }}
]"""

        raw = ""
        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, list) and len(result) == len(qa_history):
                return [
                    {
                        "score": max(0, min(10, int(item.get("score", 0)))),
                        "feedback": item.get("feedback", ""),
                        "topic": item.get("topic", "General"),
                        "strengths": item.get("strengths", []),
                        "improvements": item.get("improvements", [])
                    }
                    for item in result
                ]
        except Exception as e:
            print(f"[evaluate_all] failed: {e} | raw: {raw[:300]}")

        results = []
        for qa in qa_history:
            ev = await self.evaluate_answer(qa["question"], qa["answer"], resume_text)
            results.append(ev)
        return results

    async def evaluate_answer(self, question: str, answer: str, resume_text: str) -> Dict:
        answer_clean = (answer or "").strip()
        if len(answer_clean) < 10:
            return {"score": 0, "feedback": "No meaningful answer provided.", "topic": self._topic(question), "strengths": [], "improvements": ["Attempt to answer to receive any score."]}

        prompt = f"""Score this interview answer 0–10.

Resume context: {resume_text}
Question: {question}
Answer: {answer_clean}

Return ONLY:
{{"score": <0-10>, "feedback": "<2-3 sentences>", "topic": "<topic>", "strengths": ["<strength>"], "improvements": ["<improvement>"]}}"""

        raw = ""
        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, dict):
                result["score"] = max(0, min(10, int(result.get("score", 0))))
                result.setdefault("topic", self._topic(question))
                result.setdefault("strengths", [])
                result.setdefault("improvements", [])
                return result
        except Exception as e:
            print(f"[evaluate_answer] failed: {e}")

        wc = len(answer_clean.split())
        score = 0 if wc < 5 else 2 if wc < 15 else 3 if wc < 30 else 4
        return {"score": score, "feedback": "Answer recorded but could not be fully evaluated.", "topic": self._topic(question), "strengths": [], "improvements": ["Provide detailed answers with specific examples."]}

    # ------------------------------------------------------------------ #
    #  FINAL REPORT                                                        #
    # ------------------------------------------------------------------ #
    async def generate_final_report(self, qa_history: List[Dict], resume_text: str, total_score: float) -> Dict:
        qa_text = "\n\n".join([
            f"Q{i+1} [{qa.get('topic','General')}]: {qa['question']}\nAnswer: {qa['answer']}\nScore: {qa['score']}/10 — {qa.get('feedback','')}"
            for i, qa in enumerate(qa_history)
        ])
        recommendation = "Strong Hire" if total_score >= 80 else "Hire" if total_score >= 65 else "Maybe" if total_score >= 50 else "No Hire"

        prompt = f"""Write a post-interview evaluation report.

Resume: {resume_text}
Interview Q&A: {qa_text}
Overall Score: {total_score:.1f}/100
Recommendation: {recommendation}

Return ONLY this JSON:
{{
  "overall_score": {total_score:.1f},
  "recommendation": "{recommendation}",
  "summary": "<3-4 sentences referencing specific answers and projects>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<gap 1>", "<gap 2>"],
  "topic_scores": {{"<topic>": <score 0-10>}},
  "advice": "<1-2 sentences of concrete actionable advice>"
}}"""

        raw = ""
        try:
            raw = await _call(prompt)
            report = _clean_json(raw)
            if isinstance(report, dict):
                report["overall_score"] = total_score
                report["recommendation"] = recommendation
                return report
        except Exception as e:
            print(f"[final_report] failed: {e}")

        topics = list(dict.fromkeys(qa.get("topic", "General") for qa in qa_history))
        strong = [qa for qa in qa_history if qa.get("score", 0) >= 7]
        weak = [qa for qa in qa_history if qa.get("score", 0) <= 4]
        topic_scores = {}
        for qa in qa_history:
            t = qa.get("topic", "General")
            topic_scores[t] = max(topic_scores.get(t, 0), qa.get("score", 0))
        return {
            "overall_score": total_score,
            "recommendation": recommendation,
            "summary": f"Candidate scored {total_score:.1f}/100 across {len(qa_history)} questions covering {', '.join(topics[:4])}.",
            "strengths": [qa["topic"] for qa in strong[:2]] or ["Completed all questions"],
            "weaknesses": [qa["topic"] for qa in weak[:2]] or ["Needs more technical depth"],
            "topic_scores": topic_scores,
            "advice": "Focus on explaining the HOW and WHY behind your technical decisions, not just naming tools."
        }

    def _topic(self, question: str) -> str:
        keywords = ["PowerApps", "Power Automate", "Power BI", "SharePoint", "Azure", "SQL",
                    "Python", "JavaScript", "React", "Node.js", "Docker", "Kubernetes", "AWS", "REST", "API"]
        q_lower = question.lower()
        for kw in keywords:
            if kw.lower() in q_lower:
                return kw
        return "General"


gemini_service = GeminiService()
