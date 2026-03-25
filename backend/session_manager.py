import uuid
from typing import Dict, List
from datetime import datetime

class InterviewSession:
    def __init__(self, session_id: str, resume_text: str, resume_url: str, skills: List[str]):
        self.session_id = session_id
        self.resume_text = resume_text
        self.resume_url = resume_url
        self.skills = skills
        self.qa_history: List[Dict] = []
        self.current_question_number = 0
        self.total_questions = 5
        self.total_score = 0
        self.created_at = datetime.now()
        self.difficulty = "medium"
        self.questions_queue: List[str] = []  # Pre-generated questions
    
    def add_qa(self, question: str, answer: str, score: int, feedback: str, topic: str):
        """Add question-answer pair to history"""
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
        
        # Adjust difficulty based on performance
        if len(self.qa_history) >= 3:
            recent_avg = sum(qa["score"] for qa in self.qa_history[-3:]) / 3
            if recent_avg >= 8:
                self.difficulty = "hard"
            elif recent_avg <= 4:
                self.difficulty = "easy"
    
    def is_complete(self) -> bool:
        """Check if interview is complete"""
        return self.current_question_number >= self.total_questions
    
    def get_average_score(self) -> float:
        """Calculate average score"""
        if not self.qa_history:
            return 0
        return (self.total_score / len(self.qa_history)) * 10  # Convert to 100 scale

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, InterviewSession] = {}
    
    def create_session(self, resume_text: str, resume_url: str, skills: List[str]) -> str:
        """Create new interview session"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = InterviewSession(session_id, resume_text, resume_url, skills)
        return session_id
    
    def get_session(self, session_id: str) -> InterviewSession:
        """Get session by ID"""
        if session_id not in self.sessions:
            raise ValueError("Invalid session ID")
        return self.sessions[session_id]
    
    def delete_session(self, session_id: str):
        """Delete session"""
        if session_id in self.sessions:
            del self.sessions[session_id]

session_manager = SessionManager()
