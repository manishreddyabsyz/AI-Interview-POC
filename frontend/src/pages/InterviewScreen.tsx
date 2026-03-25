import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNextQuestion, submitAnswer } from '../api/api'
import '../styles/InterviewScreen.css'

interface Feedback {
  score: number
  feedback: string
  is_last_question: boolean
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  start(): void
  stop(): void
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface
    webkitSpeechRecognition: new () => SpeechRecognitionInterface
  }
}

function InterviewScreen() {
  const [question, setQuestion] = useState<string>('')
  const [questionNumber, setQuestionNumber] = useState<number>(0)
  const [totalQuestions, setTotalQuestions] = useState<number>(12)
  const [answer, setAnswer] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(30)
  const [loading, setLoading] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [error, setError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isSubmittingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    loadNextQuestion()
    
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      
      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('')
        setAnswer(transcript)
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (recognitionRef.current) recognitionRef.current.stop()
    }
  }, [navigate, sessionId])

  useEffect(() => {
    if (question && timeLeft > 0 && !isSubmitting) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1)
      }, 1000)
    }
    
    // Auto-submit when timer reaches 0
    if (timeLeft === 0 && question && !isSubmitting && !isSubmittingRef.current) {
      console.log('Timer reached 0, auto-submitting...')
      handleSubmit()
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [question, timeLeft, isSubmitting])

  // Remove the separate auto-submit effect

  const loadNextQuestion = async () => {
    setLoading(true)
    setError('')
    setFeedback(null)
    setAnswer('')
    setTimeLeft(30)
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      const data = await getNextQuestion(sessionId!)
      setQuestion(data.question)
      setQuestionNumber(data.question_number)
      setTotalQuestions(data.total_questions)
    } catch (err: any) {
      if (err.response?.status === 400) {
        navigate('/result')
      } else {
        setError(err.response?.data?.detail || 'Failed to load question')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting || isSubmittingRef.current) return // Prevent double submission
    
    setIsSubmitting(true)
    isSubmittingRef.current = true
    
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }

    const finalAnswer = answer.trim() || 'No answer provided'

    try {
      const result = await submitAnswer(sessionId!, questionNumber, finalAnswer)
      
      if (result.is_last_question) {
        navigate('/result')
      } else {
        // Automatically load next question without showing feedback
        await loadNextQuestion()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit answer')
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition not supported in this browser')
      return
    }

    if (isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
    } else {
      recognitionRef.current.start()
      setIsRecording(true)
    }
  }

  const handleNext = () => {
    loadNextQuestion()
  }

  const handleSkip = () => {
    handleSubmit()
  }

  return (
    <div className="interview-container">
      <div className="interview-header">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          />
        </div>
        <div className="question-counter">
          Question {questionNumber} of {totalQuestions}
        </div>
      </div>

      <div className="interview-content">
        {loading || isSubmitting ? (
          <div className="loading">
            {isSubmitting ? 'Submitting answer...' : 'Loading next question...'}
          </div>
        ) : (
          <>
            <div className="question-box">
              <div className="question-label">Question:</div>
              <div className="question-text">{question}</div>
            </div>

            <div className="timer">
              <div className={`timer-circle ${timeLeft <= 10 ? 'warning' : ''}`}>
                {timeLeft}s
              </div>
            </div>

            <div className="answer-section">
              <textarea
                className="answer-input"
                placeholder="Type your answer here or use the microphone..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isSubmitting}
              />
              
              <div className="controls">
                <button
                  className={`btn-mic ${isRecording ? 'recording' : ''}`}
                  onClick={toggleRecording}
                  disabled={isSubmitting}
                >
                  {isRecording ? '🔴 Stop' : '🎤 Record'}
                </button>
                
                <button
                  className="btn-submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit & Next'}
                </button>
              </div>
            </div>

            {error && <div className="error">{error}</div>}
          </>
        )}
      </div>
    </div>
  )
}

export default InterviewScreen
