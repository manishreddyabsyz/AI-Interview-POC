import axios from 'axios';
import type {
  ResumeUploadResponse,
  StartInterviewResponse,
  QuestionResponse,
  AnswerEvaluation,
  FinalReport
} from '../types';

const API_BASE_URL = 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadResume = async (file: File): Promise<ResumeUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post<ResumeUploadResponse>(
    `${API_BASE_URL}/upload-resume`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const startInterview = async (sessionId: string): Promise<StartInterviewResponse> => {
  const response = await api.post<StartInterviewResponse>(
    `/start-interview?session_id=${sessionId}`
  );
  return response.data;
};

export const getNextQuestion = async (sessionId: string): Promise<QuestionResponse> => {
  const response = await api.get<QuestionResponse>(
    `/next-question?session_id=${sessionId}`
  );
  return response.data;
};

export const submitAnswer = async (
  sessionId: string,
  questionNumber: number,
  answer: string
): Promise<AnswerEvaluation> => {
  const response = await api.post<AnswerEvaluation>('/submit-answer', {
    session_id: sessionId,
    question_number: questionNumber,
    answer: answer,
  });
  return response.data;
};

export const getFinalResult = async (sessionId: string): Promise<FinalReport> => {
  const response = await api.get<FinalReport>(
    `/final-result?session_id=${sessionId}`
  );
  return response.data;
};
