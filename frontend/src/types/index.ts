export interface ResumeUploadResponse {
  session_id: string
  message: string
  resume_url: string
}

export interface StartInterviewResponse {
  session_id: string
  message: string
  total_questions: number
}

export interface QuestionResponse {
  question_number: number
  question: string
  total_questions: number
}

export interface AnswerEvaluation {
  score: number
  feedback: string
  is_last_question: boolean
}

export interface FinalReport {
  overall_score: number
  strengths: string[]
  weaknesses: string[]
  recommendation: string
  summary: string
  total_questions: number
  topic_scores?: Record<string, number>
  advice?: string
}
