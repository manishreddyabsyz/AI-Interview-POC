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
  estimated_time: number
}

export interface AnswerEvaluation {
  score: number
  feedback: string
  is_last_question: boolean
}

export interface QAItem {
  question_number: number
  question: string
  answer: string
  score: number
  feedback: string
  topic: string
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
  qa_history?: QAItem[]
}
