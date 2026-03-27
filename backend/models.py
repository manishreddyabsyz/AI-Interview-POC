from pydantic import BaseModel
from typing import List, Optional, Dict

class ResumeUploadResponse(BaseModel):
    session_id: str
    message: str
    resume_url: str

class StartInterviewResponse(BaseModel):
    session_id: str
    message: str
    total_questions: int

class QuestionResponse(BaseModel):
    question_number: int
    question: str
    total_questions: int

class AnswerSubmission(BaseModel):
    session_id: str
    question_number: int
    answer: str

class AnswerEvaluation(BaseModel):
    score: int
    feedback: str
    is_last_question: bool

class FinalReport(BaseModel):
    overall_score: float
    strengths: List[str]
    weaknesses: List[str]
    recommendation: str
    summary: str
    total_questions: int
    topic_scores: Optional[Dict[str, float]] = None
    advice: Optional[str] = None
