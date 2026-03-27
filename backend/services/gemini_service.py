import json
import re
import asyncio
from typing import List, Dict
from google import genai
from config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)
MODEL = settings.GEMINI_MODEL


async def _call(prompt: str, retries: int = 3) -> str:
    """Call Gemini with automatic retry on rate limit."""
    for attempt in range(retries):
        try:
            response = client.models.generate_content(model=MODEL, contents=prompt)
            return response.text.strip()
        except Exception as e:
            err_str = str(e)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                # Extract retry delay from error message if available
                import re
                delay_match = re.search(r'retryDelay.*?(\d+)s', err_str)
                wait = int(delay_match.group(1)) + 2 if delay_match else 10 * (attempt + 1)
                wait = min(wait, 30)  # cap at 30s per attempt
                print(f"[gemini] rate limited, waiting {wait}s (attempt {attempt+1}/{retries})")
                await asyncio.sleep(wait)
                if attempt == retries - 1:
                    raise Exception(f"Gemini rate limit after {retries} retries: {e}")
            else:
                raise Exception(f"Gemini error: {e}")


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




class GeminiService:

    # ------------------------------------------------------------------ #
    #  SKILL EXTRACTION                                                    #
    # ------------------------------------------------------------------ #
    async def extract_skills(self, resume_text: str) -> List[str]:
        prompt = f"""Read this resume carefully and list every technical skill, tool, platform, framework, and technology explicitly mentioned.
Do NOT add anything not in the resume.

Resume:
{resume_text}

Return ONLY a JSON array of strings. No markdown, no explanation.
Example: ["PowerApps", "SharePoint Online", "Power Automate", "Azure AD", "SQL"]"""

        raw = ""
        try:
            raw = await _call(prompt)
            print(f"[extract_skills] raw: {raw[:300]}")
            result = _clean_json(raw)
            if isinstance(result, list):
                skills = [s.strip() for s in result if isinstance(s, str) and s.strip()]
                print(f"[extract_skills] found: {skills}")
                return skills[:20]
        except Exception as e:
            print(f"[extract_skills] failed: {e} | raw: {raw[:200]}")

        # Keyword scan fallback — only matches what's actually in the resume
        candidates = [
            "PowerApps", "Power Apps", "Power Automate", "Power BI", "SharePoint",
            "SharePoint Online", "Dataverse", "Azure AD", "Azure Active Directory",
            "Azure Automation", "Azure Logic Apps", "Microsoft 365", "Office 365",
            "Teams", "Dynamics 365", "CDS", "SQL", "Jira", "Microsoft Planner",
            "Python", "JavaScript", "TypeScript", "Java", "React", "Node.js",
            "Docker", "Kubernetes", "AWS", "GCP", "Terraform", "Git",
            "REST", "GraphQL", "MongoDB", "PostgreSQL", "MySQL", "Redis",
            "Django", "Flask", "FastAPI", "Spring Boot", "Angular", "Vue"
        ]
        found = [s for s in candidates if s.lower() in resume_text.lower()]
        print(f"[extract_skills] fallback scan: {found}")
        return found[:15] if found else ["General Technical Skills"]

    # ------------------------------------------------------------------ #
    #  QUESTION GENERATION                                                 #
    # ------------------------------------------------------------------ #
    async def generate_questions(
        self,
        resume_text: str,
        skills: List[str],
        total_questions: int = 5
    ) -> List[str]:
        skills_list = "\n".join(f"- {s}" for s in skills[:15])

        prompt = f"""You are a senior technical interviewer. You have read the candidate's full resume below.
Generate exactly {total_questions} interview questions tailored to THIS specific candidate.

STRICT RULES:
1. Every question MUST reference something specific from the resume — a named project, a specific tool they used, a role they held, or a measurable result they achieved.
2. Spread questions across DIFFERENT skills and topics. Do not ask about the same tool twice.
3. The candidate's PRIMARY skills are listed below — prioritise these:
{skills_list}
4. Use a DIFFERENT question style for each question. Rotate through:
   - Deep-dive on a specific project they built (e.g. "In your Inchcape Invoice Management App, how did you...")
   - Technical decision they made (e.g. "Why did you choose X over Y for...")
   - Challenge or problem they solved (e.g. "What was the hardest part of building...")
   - How a specific tool works based on their experience (e.g. "How does Power Automate handle...")
   - Business outcome they delivered (e.g. "You mentioned reducing manual effort by 70% — how did you...")
5. Do NOT ask generic questions. Every question must be specific enough that only this candidate can answer it well.
6. Do NOT ask about technologies not mentioned in the resume.

Full Resume:
{resume_text}

Return ONLY a raw JSON array of exactly {total_questions} question strings.
No markdown fences, no numbering, no extra text.
Format: ["Question 1?", "Question 2?", ...]"""

        raw = ""
        try:
            raw = await _call(prompt)
            print(f"[generate_questions] raw (600): {raw[:600]}")
            result = _clean_json(raw)
            if isinstance(result, list):
                questions = [q.strip() for q in result if isinstance(q, str) and len(q.strip()) > 20]
                print(f"[generate_questions] got {len(questions)} questions")
                if len(questions) >= total_questions:
                    return questions[:total_questions]
                if questions:
                    return await self._fill_remaining(questions, resume_text, skills, total_questions)
        except Exception as e:
            print(f"[generate_questions] failed: {e} | raw: {raw[:300]}")

        print("[generate_questions] falling back to one-by-one")
        return await self._generate_individually(resume_text, skills, total_questions)

    async def _fill_remaining(self, existing, resume_text, skills, total):
        covered = {s.lower() for q in existing for s in skills if s.lower() in q.lower()}
        uncovered = [s for s in skills if s.lower() not in covered] or skills
        for i in range(total - len(existing)):
            skill = uncovered[i % len(uncovered)]
            q = await self._single_question(resume_text, skill, existing)
            existing.append(q)
        return existing

    async def _generate_individually(self, resume_text, skills, total):
        questions: List[str] = []
        used: List[str] = []
        for i in range(total):
            skill = next((s for s in skills if s not in used), skills[i % len(skills)])
            used.append(skill)
            q = await self._single_question(resume_text, skill, questions)
            questions.append(q)
            print(f"[individually] Q{i+1} ({skill}): {q}")
        return questions

    async def _single_question(self, resume_text, skill, previous):
        prev_str = "\n".join(f"- {q}" for q in previous) if previous else "None"
        styles = [
            f"Ask about a specific project in the resume where they used {skill} — what they built and the technical approach",
            f"Ask about a real challenge or failure they faced while working with {skill} and how they resolved it",
            f"Ask how {skill} works under the hood and how they applied that knowledge in a specific scenario from their resume",
            f"Ask about a business outcome or measurable improvement they achieved using {skill}",
            f"Ask about an integration, automation, or workflow they designed involving {skill}",
        ]
        style = styles[len(previous) % len(styles)]

        prompt = f"""You are a technical interviewer. Generate ONE specific interview question about {skill} for this candidate.

Style: {style}
The question must reference something concrete from the resume.
Do NOT repeat or rephrase these already-asked questions:
{prev_str}

Resume:
{resume_text}

Return ONLY the question as plain text. No quotes, no markdown."""

        try:
            q = (await _call(prompt)).strip().strip('"').strip("'")
            if len(q) > 20:
                return q
        except Exception as e:
            print(f"[_single_question] failed for {skill}: {e}")

        fallbacks = [
            f"In your resume you mention using {skill} — describe a specific project where it was central and what technical decisions you made.",
            f"What was the most complex problem you solved using {skill}, and how did you approach it?",
            f"How did you use {skill} to deliver a measurable business improvement in one of your roles?",
            f"What limitations did you encounter with {skill} and how did you work around them?",
            f"How did you ensure quality, reliability, or governance when deploying solutions built on {skill}?",
        ]
        return fallbacks[len(previous) % len(fallbacks)]

    # ------------------------------------------------------------------ #
    #  ANSWER EVALUATION                                                   #
    # ------------------------------------------------------------------ #
    async def evaluate_answer(self, question: str, answer: str, resume_text: str) -> Dict:
        answer_clean = (answer or "").strip()

        if len(answer_clean) < 10:
            return {
                "score": 0,
                "feedback": "No meaningful answer was provided.",
                "topic": self._topic(question),
                "strengths": [],
                "improvements": ["You must attempt to answer to receive any score."]
            }

        prompt = f"""You are a strict technical interviewer scoring a candidate's answer.

Candidate resume (background context):
{resume_text}

Question: {question}

Candidate's answer: {answer_clean}

Score 0–10 strictly:
0   — No answer, off-topic, or gibberish
1-2 — Wrong or shows no real understanding
3-4 — Very vague, surface-level, mostly incorrect
5-6 — Partially correct, missing key details or depth
7-8 — Good, technically sound, minor gaps only
9-10 — Excellent: accurate, detailed, shows real hands-on experience

Rules:
- A one-sentence vague answer is 2–3 maximum
- Naming a tool without explaining how = 3–4
- Good answers explain HOW and WHY, not just WHAT
- Be strict — no benefit of the doubt

Return ONLY this JSON (no markdown):
{{
  "score": <0-10 integer>,
  "feedback": "<2-3 sentences: what was good and what was missing>",
  "topic": "<main topic, e.g. PowerApps, SharePoint, Power Automate>",
  "strengths": ["<one specific strength, or empty if score <= 3>"],
  "improvements": ["<one specific improvement>"]
}}"""

        raw = ""
        try:
            raw = await _call(prompt)
            print(f"[evaluate_answer] raw: {raw[:300]}")
            result = _clean_json(raw)
            if isinstance(result, dict):
                result["score"] = max(0, min(10, int(result.get("score", 0))))
                result.setdefault("topic", self._topic(question))
                result.setdefault("strengths", [])
                result.setdefault("improvements", [])
                return result
        except Exception as e:
            print(f"[evaluate_answer] failed: {e} | raw: {raw[:200]}")

        wc = len(answer_clean.split())
        score = 0 if wc < 5 else 2 if wc < 15 else 3 if wc < 30 else 4
        return {
            "score": score,
            "feedback": "Answer recorded but could not be fully evaluated.",
            "topic": self._topic(question),
            "strengths": [],
            "improvements": ["Provide detailed, structured answers with specific examples."]
        }

    # ------------------------------------------------------------------ #
    #  FINAL REPORT                                                        #
    # ------------------------------------------------------------------ #
    async def generate_final_report(self, qa_history: List[Dict], resume_text: str, total_score: float) -> Dict:
        qa_text = "\n\n".join([
            f"Q{i+1} [{qa.get('topic','General')}]: {qa['question']}\n"
            f"Answer: {qa['answer']}\n"
            f"Score: {qa['score']}/10 — {qa.get('feedback','')}"
            for i, qa in enumerate(qa_history)
        ])

        recommendation = (
            "Strong Hire" if total_score >= 80 else
            "Hire"        if total_score >= 65 else
            "Maybe"       if total_score >= 50 else
            "No Hire"
        )

        prompt = f"""You are a senior technical interviewer writing a post-interview evaluation.

Candidate Resume:
{resume_text}

Interview Q&A:
{qa_text}

Overall Score: {total_score:.1f}/100
Recommendation: {recommendation}

Write a personalised report based on the actual answers above.
Return ONLY this JSON (no markdown):
{{
  "overall_score": {total_score:.1f},
  "recommendation": "{recommendation}",
  "summary": "<3-4 sentences referencing their specific answers, named projects, and actual performance>",
  "strengths": ["<specific strength from their answers>", "<another>"],
  "weaknesses": ["<specific gap from their answers>", "<another>"],
  "topic_scores": {{"<topic>": <score 0-10>}},
  "advice": "<1-2 sentences of concrete actionable advice for this specific candidate>"
}}"""

        raw = ""
        try:
            raw = await _call(prompt)
            print(f"[final_report] raw (500): {raw[:500]}")
            report = _clean_json(raw)
            if isinstance(report, dict):
                report["overall_score"] = total_score
                report["recommendation"] = recommendation
                return report
        except Exception as e:
            print(f"[final_report] failed: {e} | raw: {raw[:200]}")

        topics = list(dict.fromkeys(qa.get("topic", "General") for qa in qa_history))
        strong = [qa for qa in qa_history if qa.get("score", 0) >= 7]
        weak   = [qa for qa in qa_history if qa.get("score", 0) <= 4]
        topic_scores = {}
        for qa in qa_history:
            t = qa.get("topic", "General")
            topic_scores[t] = max(topic_scores.get(t, 0), qa.get("score", 0))

        return {
            "overall_score": total_score,
            "recommendation": recommendation,
            "summary": (
                f"Candidate scored {total_score:.1f}/100 across {len(qa_history)} questions "
                f"covering {', '.join(topics[:4])}. "
                + (f"Strongest in {strong[0]['topic']}." if strong else "Struggled to demonstrate depth.")
            ),
            "strengths": [qa["topic"] for qa in strong[:2]] or ["Completed all questions"],
            "weaknesses": [qa["topic"] for qa in weak[:2]] or ["Needs more technical depth"],
            "topic_scores": topic_scores,
            "advice": "Focus on explaining the HOW and WHY behind your technical decisions, not just naming tools."
        }

    def _topic(self, question: str) -> str:
        keywords = [
            "PowerApps", "Power Apps", "Power Automate", "Power BI",
            "SharePoint", "Dataverse", "Azure AD", "Azure Automation",
            "Azure Logic Apps", "Microsoft 365", "Office 365", "Dynamics 365",
            "SQL", "Python", "JavaScript", "React", "Node.js",
            "Docker", "Kubernetes", "AWS", "REST", "API",
            "testing", "CI/CD", "security", "performance", "architecture"
        ]
        q_lower = question.lower()
        for kw in keywords:
            if kw.lower() in q_lower:
                return kw
        return "General"


gemini_service = GeminiService()
