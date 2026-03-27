import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNextQuestion, submitAnswer } from '../api/api'
import '../styles/InterviewScreen.css'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionResultList {
  length: number
  [index: number]: SpeechRecognitionResult
}
interface SpeechRecognitionResult {
  isFinal: boolean
  [index: number]: SpeechRecognitionAlternative
}
interface SpeechRecognitionAlternative {
  transcript: string
}
interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface
    webkitSpeechRecognition: new () => SpeechRecognitionInterface
  }
}

type PermissionState = 'pending' | 'granted' | 'denied'

function InterviewScreen() {
  const [permissionState, setPermissionState] = useState<PermissionState>('pending')
  const [permissionError, setPermissionError] = useState<string>('')

  const [question, setQuestion] = useState<string>('')
  const [questionNumber, setQuestionNumber] = useState<number>(0)
  const [totalQuestions, setTotalQuestions] = useState<number>(5)
  const [answer, setAnswer] = useState<string>('')
  const [interimAnswer, setInterimAnswer] = useState<string>('')
  const [timeLeft, setTimeLeft] = useState<number>(30)
  const [loading, setLoading] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSubmittingRef = useRef(false)
  const answerRef = useRef<string>('')
  const interimRef = useRef<string>('')
  const autoSubmitRef = useRef<() => void>(() => {})

  // Keep refs in sync so timer/submit always have latest values
  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { interimRef.current = interimAnswer }, [interimAnswer])
  // Keep autoSubmitRef pointing to latest handleSubmit (defined below, updated each render)

  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [permissionState])

  // Keep answerRef in sync so timer callback always has latest value
  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    requestPermissions()
    return () => cleanup()
  }, [])

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      // Use a small delay to ensure the video element is mounted before assigning
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      }, 100)
      setPermissionState('granted')
      initSpeechRecognition()
      loadNextQuestion()
    } catch (err: any) {
      setPermissionState('denied')
      if (err.name === 'NotAllowedError') {
        setPermissionError('Camera and microphone access was denied. You must allow both to proceed with the interview.')
      } else if (err.name === 'NotFoundError') {
        setPermissionError('No camera or microphone found. Please connect a device and try again.')
      } else {
        setPermissionError(`Could not access camera/microphone: ${err.message}`)
      }
    }
  }

  const initSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript + ' '
        } else {
          interimText += result[0].transcript
        }
      }
      if (finalText) setAnswer(prev => (prev + ' ' + finalText).trim())
      setInterimAnswer(interimText)
    }

    recognition.onerror = () => {
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
      setInterimAnswer('')
    }

    recognitionRef.current = recognition
  }

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) recognitionRef.current.abort()
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!question || isSubmitting || permissionState !== 'granted') return
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(30)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          // Use ref to avoid stale closure
          autoSubmitRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [question]) // only re-run when question changes

  // ── Load question ──────────────────────────────────────────────────────
  const loadNextQuestion = async () => {
    setLoading(true)
    setError('')
    setAnswer('')
    setInterimAnswer('')
    setTimeLeft(30)
    if (timerRef.current) clearInterval(timerRef.current)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      setIsRecording(false)
    }
    // Reinitialize recognition for clean state on each question
    initSpeechRecognition()
    try {
      const data = await getNextQuestion(sessionId!)
      setQuestion(data.question)
      setQuestionNumber(data.question_number)
      setTotalQuestions(data.total_questions)
    } catch (err: any) {
      if (err.response?.status === 400) navigate('/result')
      else setError(err.response?.data?.detail || 'Failed to load question')
    } finally {
      setLoading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsSubmitting(true)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch {}
      setIsRecording(false)
    }
    const finalAnswer = (answerRef.current + ' ' + interimRef.current).trim() || 'No answer provided'
    try {
      const result = await submitAnswer(sessionId!, questionNumber, finalAnswer)
      if (result.is_last_question) {
        navigate('/result')
      } else {
        await loadNextQuestion()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit answer')
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  // ── Toggle mic ─────────────────────────────────────────────────────────
  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser. Please type your answer.')
      return
    }
    if (isRecording) {
      try { recognitionRef.current.stop() } catch {}
      setIsRecording(false)
    } else {
      setAnswer('')
      setInterimAnswer('')
      try {
        recognitionRef.current.abort() // ensure clean state before starting
        setTimeout(() => {
          try {
            recognitionRef.current?.start()
            setIsRecording(true)
          } catch (e) {
            console.warn('Speech start error:', e)
          }
        }, 100)
      } catch {}
    }
  }

  // Wire autoSubmitRef to always call latest handleSubmit
  useEffect(() => { autoSubmitRef.current = handleSubmit })

  // ── Permission gate ────────────────────────────────────────────────────
  if (permissionState === 'pending') {
    return (
      <div className="interview-container">
        <div className="permission-gate">
          <div className="permission-icon">📷</div>
          <h2>Camera & Microphone Required</h2>
          <p>Please allow access to your camera and microphone to begin the interview.</p>
          <div className="permission-spinner" />
        </div>
      </div>
    )
  }

  if (permissionState === 'denied') {
    return (
      <div className="interview-container">
        <div className="permission-gate denied">
          <div className="permission-icon">🚫</div>
          <h2>Access Denied</h2>
          <p>{permissionError}</p>
          <p className="permission-hint">
            Click the camera icon in your browser's address bar to allow access, then refresh the page.
          </p>
          <button className="btn-submit" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // ── Main interview UI ──────────────────────────────────────────────────
  return (
    <div className="interview-container">
      <div className="interview-header">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
        </div>
        <div className="question-counter">Question {questionNumber} of {totalQuestions}</div>
      </div>

      <div className="interview-body">
        {/* Camera feed — always visible so candidate knows they're on camera */}
        <div className="camera-panel">
          <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
          <div className={`camera-status ${isRecording ? 'recording' : ''}`}>
            {isRecording ? '🔴 Recording' : '🎥 Live'}
          </div>
        </div>

        <div className="interview-content">
          {loading || isSubmitting ? (
            <div className="loading">
              {isSubmitting ? 'Submitting...' : 'Loading next question...'}
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
                  placeholder="Speak using the mic or type your answer here..."
                  value={answer + (interimAnswer ? ' ' + interimAnswer : '')}
                  onChange={e => setAnswer(e.target.value)}
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
                  <button className="btn-submit" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? 'Submitting...' : 'Submit & Next'}
                  </button>
                </div>
              </div>

              {error && <div className="error">{error}</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default InterviewScreen
