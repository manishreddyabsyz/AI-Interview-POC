import json
import re
import asyncio
from typing import List, Dict, Any
import httpx
from config import settings

OLLAMA_URL = f"{settings.OLLAMA_BASE_URL}/api/chat"
MODEL = settings.OLLAMA_MODEL


async def _call(prompt: str, retries: int = 3) -> str:
    """Call local Ollama with automatic retry on failure."""
    payload = {
        "model": MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    for attempt in range(retries):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(OLLAMA_URL, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"].strip()
        except Exception as e:
            print(f"[ollama] attempt {attempt+1}/{retries} failed: {e}")
            if attempt == retries - 1:
                raise Exception(f"Ollama error after {retries} retries: {e}")
            await asyncio.sleep(2 * (attempt + 1))


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


def _estimate_seconds(question: str) -> int:
    """Estimate answer time based on question length and complexity."""
    words = len(question.split())
    deep_keywords = ["explain", "describe", "how did you", "walk me through", "what was", "challenge", "process", "architecture", "design", "compare", "why did you"]
    score = sum(1 for kw in deep_keywords if kw.lower() in question.lower())
    base = 45 + (words // 10) * 5 + score * 10
    return max(30, min(90, base))


class OllamaService:

    # ------------------------------------------------------------------ #
    #  SKILL EXTRACTION                                                    #
    # ------------------------------------------------------------------ #
    async def extract_skills(self, resume_text: str, jd_text: str = "") -> List[str]:
        jd_block = f"\nJob Description:\n{jd_text}\n" if jd_text.strip() else ""
        prompt = f"""Read the resume and job description (if provided) carefully.
List every technical skill, tool, platform, framework, and technology mentioned.
Prioritise skills that appear in the Job Description first, then add remaining resume skills.
Do NOT add anything not present in either text.

Resume:
{resume_text}
{jd_block}
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
        combined = resume_text + " " + jd_text
        found = [s for s in candidates if s.lower() in combined.lower()]
        print(f"[extract_skills] fallback scan: {found}")
        return found[:15] if found else ["General Technical Skills"]

    # ------------------------------------------------------------------ #
    #  QUESTION GENERATION  — two-step: extract requirements → ask        #
    # ------------------------------------------------------------------ #

    async def generate_questions(
        self,
        resume_text: str,
        skills: List[str],
        total_questions: int = 5,
        jd_text: str = ""
    ) -> List[Dict[str, Any]]:
        resume_trimmed = resume_text[:3000]
        jd_trimmed     = jd_text[:2500] if jd_text.strip() else ""

        # Step 1 — extract concrete JD requirements (if JD provided)
        jd_requirements: List[str] = []
        if jd_trimmed:
            jd_requirements = await self._extract_jd_requirements(jd_trimmed)
            print(f"[JD requirements] {jd_requirements}")

        # Step 2 — extract concrete resume facts
        resume_facts = await self._extract_resume_facts(resume_trimmed)
        print(f"[Resume facts] {resume_facts}")

        # Build a question plan:
        # If JD provided: 3 from JD requirements + 2 from resume facts
        # If no JD:       5 from resume facts
        plan: List[Dict] = []
        if jd_requirements:
            for i in range(min(3, total_questions)):
                plan.append({"source": "jd", "fact": jd_requirements[i % len(jd_requirements)]})
        resume_slots = total_questions - len(plan)
        for i in range(resume_slots):
            plan.append({"source": "resume", "fact": resume_facts[i % len(resume_facts)]})

        # Step 3 — generate one question per plan item
        questions: List[Dict[str, Any]] = []
        for i, item in enumerate(plan):
            q = await self._question_from_fact(
                fact       = item["fact"],
                source     = item["source"],
                resume_text= resume_trimmed,
                jd_text    = jd_trimmed,
                previous   = questions,
                skills     = skills
            )
            questions.append({"question": q, "estimated_seconds": _estimate_seconds(q)})
            print(f"[Q{i+1}] ({item['source']}): {q}")

        return questions

    # ── Step 1a: pull concrete requirements out of JD ──────────────────
    async def _extract_jd_requirements(self, jd_text: str) -> List[str]:
        prompt = f"""Below is a job description. List 6 specific skills or responsibilities that a candidate must demonstrate.

Rules:
- Only include actual technical skills, tasks, or responsibilities
- Do NOT include job title, location, engagement type, or contract details
- Each item must be a thing the candidate needs to DO or KNOW
- Keep each item under 20 words

Job Description:
{jd_text}

Return ONLY a JSON array of 6 strings. No markdown, no explanation.
Example output: ["build interactive US map UI using JavaScript", "integrate RESTful APIs with Python backend", "deploy applications on Microsoft Azure", "implement CI/CD pipelines", "design agentic AI workflows", "build full stack web applications"]"""

        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, list):
                items = [r.strip() for r in result if isinstance(r, str) and len(r.strip()) > 8]
                # Filter out anything that looks like a job title or metadata
                bad_words = ["t&m", "near-shore", "offshore", "contract duration", "engagement type", "overview", "location"]
                items = [i for i in items if not any(b in i.lower() for b in bad_words)]
                if len(items) >= 3:
                    return items[:8]
        except Exception as e:
            print(f"[extract_jd_requirements] failed: {e}")

        # Fallback: extract only bullet-point lines (actual requirements)
        requirement_keywords = [
            "build", "develop", "design", "integrate", "experience with", "proficiency",
            "knowledge of", "implement", "deploy", "create", "maintain", "support",
            "familiarity", "working with", "using", "deliver", "collaborate", "perform"
        ]
        lines = [l.strip().lstrip("·•-‑").strip() for l in jd_text.splitlines()]
        filtered = [
            l for l in lines
            if 15 < len(l) < 120 and any(kw in l.lower() for kw in requirement_keywords)
        ]
        print(f"[extract_jd_requirements] fallback extracted: {filtered[:8]}")
        return filtered[:8] if filtered else ["full stack development with Python and JavaScript"]

    # ── Step 1b: pull concrete facts out of resume ─────────────────────
    async def _extract_resume_facts(self, resume_text: str) -> List[str]:
        prompt = f"""Read this resume. Extract 6 specific facts — each one a concrete project, tool used, result achieved, or responsibility held. Use exact names from the resume.

Keep each item short (under 20 words). Be literal.

Resume:
{resume_text}

Return ONLY a JSON array of 6 strings. No markdown, no explanation.
Example: ["built Invoice Management App using Power Automate at Inchcape", "reduced manual processing time by 40% using SharePoint workflows", "designed Azure AD integration for SSO across 3 applications"]"""

        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, list):
                items = [r.strip() for r in result if isinstance(r, str) and len(r.strip()) > 5]
                if len(items) >= 2:
                    return items[:8]
        except Exception as e:
            print(f"[extract_resume_facts] failed: {e}")

        # Fallback: extract non-empty lines from resume as facts
        lines = [l.strip() for l in resume_text.splitlines() if 15 < len(l.strip()) < 120]
        return lines[:8] if lines else ["general technical experience"]

    # ── Step 2: generate one question from a concrete fact ─────────────
    async def _question_from_fact(
        self,
        fact: str,
        source: str,
        resume_text: str,
        jd_text: str,
        previous: List[Dict],
        skills: List[str] = None
    ) -> str:
        # Guard: skip facts that are clearly job metadata, not skills
        bad_patterns = ["t&m", "near-shore", "offshore", "contract duration",
                        "engagement type", "location", "work model", "overview"]
        if any(b in fact.lower() for b in bad_patterns):
            print(f"[question_from_fact] skipping bad fact: {fact}")
            fact = "full stack development using Python and JavaScript"
        prev_str = "\n".join(f"- {q['question']}" for q in previous) if previous else "None"

        if source == "jd":
            angle = (
                "The JD requires this. Ask the candidate HOW they have done exactly this in a specific project "
                "from their resume. Ask which specific tools/libraries/methods they used, why they chose them "
                "over alternatives, and what difficulties they encountered. Name the project from the resume."
            )
        else:
            angle = (
                "This is something specific from the candidate's resume. Ask them to go deeper — "
                "HOW did they implement it technically, WHICH specific tools or approaches did they use, "
                "WHAT was the hardest part, and WHAT would they do differently now."
            )

        prompt = f"""You are a technical interviewer. Generate exactly ONE interview question.

SPECIFIC FACT TO ASK ABOUT:
"{fact}"

ANGLE: {angle}

CANDIDATE RESUME (for context — reference specific projects/roles by name):
{resume_text}

ALREADY ASKED — do NOT repeat or rephrase:
{prev_str}

RULES:
- The question must be directly about the fact above
- Name something concrete (a project, tool, company, or metric) — not generic
- Ask HOW / WHICH tools / WHAT difficulties / WHY that choice — not just "tell me about"
- Do NOT start with: "Tell me about", "Walk me through your background", "Can you describe your experience"
- One question only, ending with a question mark

Write the question only."""

        try:
            raw = (await _call(prompt)).strip().strip('"').strip("'").strip()
            if len(raw) > 30 and ("?" in raw or len(raw) > 60):
                return raw
        except Exception as e:
            print(f"[question_from_fact] failed: {e}")

        # Direct fallback — use the fact itself as the basis
        if source == "jd":
            return f"The role requires you to {fact} — in a specific project from your resume, how did you do this, which tools did you use, and what challenges did you face?"
        else:
            return f"Your resume mentions {fact} — what was the specific technical approach you used, and what was the hardest problem you had to solve?"

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

{qa_block}

Score each answer 0–10:
0=no answer, 1-2=wrong, 3-4=vague, 5-6=partial, 7-8=good, 9-10=excellent with hands-on depth.

Return ONLY a JSON array of exactly {len(qa_history)} objects (no markdown):
[{{"index":0,"score":<int>,"feedback":"<2-3 sentences>","topic":"<topic>","strengths":["<strength>"],"improvements":["<improvement>"]}}...]"""

        raw = ""
        try:
            raw = await _call(prompt)
            result = _clean_json(raw)
            if isinstance(result, list) and len(result) == len(qa_history):
                return [{
                    "score": max(0, min(10, int(item.get("score", 0)))),
                    "feedback": item.get("feedback", ""),
                    "topic": item.get("topic", "General"),
                    "strengths": item.get("strengths", []),
                    "improvements": item.get("improvements", [])
                } for item in result]
        except Exception as e:
            print(f"[evaluate_all] failed: {e} | raw: {raw[:300]}")

        results = []
        for qa in qa_history:
            ev = await self.evaluate_answer(qa["question"], qa["answer"], resume_text)
            results.append(ev)
        return results

    # ------------------------------------------------------------------ #
    #  SINGLE ANSWER EVALUATION                                            #
    # ------------------------------------------------------------------ #
    async def evaluate_answer(self, question: str, answer: str, resume_text: str) -> Dict:
        answer_clean = (answer or "").strip()
        if len(answer_clean) < 10:
            return {"score": 0, "feedback": "No meaningful answer was provided.",
                    "topic": self._topic(question), "strengths": [],
                    "improvements": ["You must attempt to answer to receive any score."]}
        prompt = f"""Score this interview answer 0–10 strictly.
Resume context: {resume_text[:500]}
Question: {question}
Answer: {answer_clean}
0=none,1-2=wrong,3-4=vague,5-6=partial,7-8=good,9-10=excellent.
Return ONLY JSON: {{"score":<int>,"feedback":"<2-3 sentences>","topic":"<topic>","strengths":["<s>"],"improvements":["<i>"]}}"""
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
        return {"score": 0 if wc < 5 else 2 if wc < 15 else 3,
                "feedback": "Answer recorded but could not be fully evaluated.",
                "topic": self._topic(question), "strengths": [],
                "improvements": ["Provide detailed answers with specific examples."]}

    # ------------------------------------------------------------------ #
    #  FINAL REPORT                                                        #
    # ------------------------------------------------------------------ #
    async def generate_final_report(self, qa_history: List[Dict], resume_text: str, total_score: float) -> Dict:
        qa_text = "\n\n".join([
            f"Q{i+1} [{qa.get('topic','General')}]: {qa['question']}\n"
            f"Answer: {qa['answer']}\nScore: {qa['score']}/10 — {qa.get('feedback','')}"
            for i, qa in enumerate(qa_history)
        ])
        recommendation = ("Strong Hire" if total_score >= 80 else "Hire" if total_score >= 65
                          else "Maybe" if total_score >= 50 else "No Hire")
        prompt = f"""Write a post-interview evaluation based on actual answers.
Resume: {resume_text[:800]}
Q&A: {qa_text}
Score: {total_score:.1f}/100, Recommendation: {recommendation}
Return ONLY JSON (no markdown):
{{"overall_score":{total_score:.1f},"recommendation":"{recommendation}","summary":"<3-4 sentences>","strengths":["<s1>","<s2>"],"weaknesses":["<w1>","<w2>"],"topic_scores":{{"<topic>":<score>}},"advice":"<1-2 sentences>"}}"""
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
            "overall_score": total_score, "recommendation": recommendation,
            "summary": f"Candidate scored {total_score:.1f}/100 across {len(qa_history)} questions covering {', '.join(topics[:4])}.",
            "strengths": [qa["topic"] for qa in strong[:2]] or ["Completed all questions"],
            "weaknesses": [qa["topic"] for qa in weak[:2]] or ["Needs more technical depth"],
            "topic_scores": topic_scores,
            "advice": "Focus on explaining HOW and WHY behind your technical decisions, not just naming tools."
        }

    def _topic(self, question: str) -> str:
        keywords = ["PowerApps", "Power Apps", "Power Automate", "Power BI", "SharePoint",
                    "Dataverse", "Azure AD", "Azure Automation", "Azure Logic Apps",
                    "Microsoft 365", "Office 365", "Dynamics 365", "SQL", "Python",
                    "JavaScript", "React", "Node.js", "Docker", "Kubernetes", "AWS",
                    "REST", "API", "testing", "CI/CD", "security", "performance", "architecture"]
        q_lower = question.lower()
        for kw in keywords:
            if kw.lower() in q_lower:
                return kw
        return "General"


ollama_service = OllamaService()
