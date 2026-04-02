import uuid
from typing import Dict, List, Any
from datetime import datetime

class InterviewSession:
    def __init__(self, session_id: str, resume_text: str, resume_url: str, skills: List[str], jd_text: str = ""):
        self.session_id = session_id
        self.resume_text = resume_text
        self.resume_url = resume_url
        self.skills = skills
        self.jd_text = jd_text
        self.qa_history: List[Dict] = []
        self.current_question_number = 0
        self.total_questions = 5
        self.total_score = 0
        self.created_at = datetime.now()
        self.difficulty = "medium"
        self.questions_queue: List[Dict[str, Any]] = []  # [{"question": str, "estimated_seconds": int}]

    def add_qa(self, question: str, answer: str, score: int, feedback: str, topic: str):
        self.qa_history.append({
            "question_number": self.current_question_number,
            "question": question,
            "answer": answer,
            "score": score,
            "feedback": feedback,
            "topic": topic
        })
        self.total_score += score
        self.current_question_number += 1

        if len(self.qa_history) >= 3:
            recent_avg = sum(qa["score"] for qa in self.qa_history[-3:]) / 3
            if recent_avg >= 8:
                self.difficulty = "hard"
            elif recent_avg <= 4:
                self.difficulty = "easy"

    def is_complete(self) -> bool:
        return self.current_question_number >= self.total_questions

    def get_average_score(self) -> float:
        if not self.qa_history:
            return 0
        return (self.total_score / len(self.qa_history)) * 10


class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, InterviewSession] = {}

    def create_session(self, resume_text: str, resume_url: str, skills: List[str], jd_text: str = "") -> str:
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = InterviewSession(session_id, resume_text, resume_url, skills, jd_text)
        return session_id

    def get_session(self, session_id: str) -> InterviewSession:
        if session_id not in self.sessions:
            raise ValueError("Invalid session ID")
        return self.sessions[session_id]

    def delete_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]


session_manager = SessionManager()
