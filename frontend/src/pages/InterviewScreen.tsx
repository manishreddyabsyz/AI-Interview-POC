import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as faceapi from '@vladmandic/face-api'
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
interface SpeechRecognitionAlternative { transcript: string }
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
type ViolationType = 'multiple_faces' | 'no_face' | null

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

  // Proctoring state
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const [violation, setViolation] = useState<ViolationType>(null)
  const [violationWarning, setViolationWarning] = useState<string>('')
  const [violationCount, setViolationCount] = useState(0)
  const [examTerminated, setExamTerminated] = useState(false)

  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInterface | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const faceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSubmittingRef = useRef(false)
  const answerRef = useRef<string>('')
  const interimRef = useRef<string>('')
  const autoSubmitRef = useRef<() => void>(() => {})
  const violationCountRef = useRef(0)
  const violationActiveRef = useRef(false)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { interimRef.current = interimAnswer }, [interimAnswer])

  // ── Load face detection models ─────────────────────────────────────────
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      .then(() => {
        setFaceModelsLoaded(true)
        console.log('[proctoring] face detection model loaded')
      })
      .catch(e => console.warn('[proctoring] model load failed:', e))
  }, [])

  // ── Attach stream to video ─────────────────────────────────────────────
  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [permissionState])

  // ── Request camera + mic ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    requestPermissions()
    return () => cleanup()
  }, [])

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
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
        setPermissionError('Camera and microphone access was denied. You must allow both to proceed.')
      } else if (err.name === 'NotFoundError') {
        setPermissionError('No camera or microphone found. Please connect a device and try again.')
      } else {
        setPermissionError(`Could not access camera/microphone: ${err.message}`)
      }
    }
  }

  // ── Face detection loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!faceModelsLoaded || permissionState !== 'granted' || examTerminated) return

    faceCheckRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        )
        const count = detections.length
        handleFaceCount(count)
      } catch {}
    }, 1500) // check every 1.5 seconds

    return () => { if (faceCheckRef.current) clearInterval(faceCheckRef.current) }
  }, [faceModelsLoaded, permissionState, examTerminated])

  const handleFaceCount = useCallback((count: number) => {
    if (count === 1) {
      // All good — clear any active violation
      if (violationActiveRef.current) {
        violationActiveRef.current = false
        setViolation(null)
        setViolationWarning('')
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      }
      return
    }

    const type: ViolationType = count === 0 ? 'no_face' : 'multiple_faces'

    // Don't re-trigger if same violation already active
    if (violationActiveRef.current) return
    violationActiveRef.current = true

    violationCountRef.current += 1
    const newCount = violationCountRef.current
    setViolationCount(newCount)

    const message = count === 0
      ? `⚠️ You are not visible on camera. Please stay in frame. (Warning ${newCount}/3)`
      : `🚨 Another person detected in frame. This is not allowed. (Warning ${newCount}/3)`

    setViolation(type)
    setViolationWarning(message)

    if (newCount >= 3) {
      // Terminate exam
      setExamTerminated(true)
      if (faceCheckRef.current) clearInterval(faceCheckRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
      return
    }

    // Auto-clear warning after 5 seconds if face returns
    warningTimerRef.current = setTimeout(() => {
      violationActiveRef.current = false
      setViolation(null)
      setViolationWarning('')
    }, 5000)
  }, [])

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (faceCheckRef.current) clearInterval(faceCheckRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
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
      // Only process NEW results from resultIndex — not all results from 0
      // This prevents the duplication bug in Web Speech API
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      if (finalText) setAnswer(prev => (prev ? prev + ' ' + finalText.trim() : finalText.trim()))
      setInterimAnswer(interimText)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => { setIsRecording(false); setInterimAnswer('') }
    recognitionRef.current = recognition
  }

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!question || isSubmitting || permissionState !== 'granted' || examTerminated) return
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(30)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          timerRef.current = null
          autoSubmitRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [question, examTerminated])

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
      if (result.is_last_question) navigate('/result')
      else await loadNextQuestion()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit answer')
    } finally {
      setIsSubmitting(false)
      isSubmittingRef.current = false
    }
  }

  useEffect(() => { autoSubmitRef.current = handleSubmit })

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported. Please type your answer.')
      return
    }
    if (isRecording) {
      try { recognitionRef.current.stop() } catch {}
      setIsRecording(false)
    } else {
      setAnswer('')
      setInterimAnswer('')
      try {
        recognitionRef.current.abort()
        setTimeout(() => {
          try { recognitionRef.current?.start(); setIsRecording(true) } catch {}
        }, 100)
      } catch {}
    }
  }

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
          <p className="permission-hint">Click the camera icon in your browser's address bar to allow access, then refresh.</p>
          <button className="btn-submit" onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    )
  }

  // ── Exam terminated ────────────────────────────────────────────────────
  if (examTerminated) {
    return (
      <div className="interview-container">
        <div className="permission-gate denied">
          <div className="permission-icon">🚫</div>
          <h2>Exam Terminated</h2>
          <p>Your exam has been terminated due to repeated proctoring violations:</p>
          <ul style={{ textAlign: 'left', color: '#6b7280', margin: '12px 0' }}>
            <li>Multiple people detected in frame, or</li>
            <li>Candidate not visible on camera</li>
          </ul>
          <p>You received <strong>{violationCount} warnings</strong> before termination.</p>
          <button className="btn-submit" onClick={() => { localStorage.removeItem('sessionId'); navigate('/') }}>
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  // ── Main interview UI ──────────────────────────────────────────────────
  return (
    <div className="interview-container">
      {/* Violation banner */}
      {violationWarning && (
        <div className={`violation-banner ${violation === 'multiple_faces' ? 'danger' : 'warning'}`}>
          {violationWarning}
        </div>
      )}

      <div className="interview-header">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
        </div>
        <div className="question-counter">Question {questionNumber} of {totalQuestions}</div>
      </div>

      <div className="interview-body">
        {/* Camera panel */}
        <div className="camera-panel">
          <div className={`camera-wrapper ${violation ? 'camera-violation' : ''}`}>
            <video ref={videoRef} autoPlay muted playsInline className="camera-feed" />
            <canvas ref={canvasRef} className="camera-canvas" />
          </div>
          <div className={`camera-status ${isRecording ? 'recording' : ''} ${violation ? 'violation' : ''}`}>
            {violation === 'multiple_faces' ? '🚨 Multiple faces' :
             violation === 'no_face' ? '⚠️ Not visible' :
             isRecording ? '🔴 Recording' : '🎥 Live'}
          </div>
          {violationCount > 0 && (
            <div className="violation-counter">
              ⚠️ {violationCount}/3 warnings
            </div>
          )}
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
                  <button className={`btn-mic ${isRecording ? 'recording' : ''}`} onClick={toggleRecording} disabled={isSubmitting}>
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
