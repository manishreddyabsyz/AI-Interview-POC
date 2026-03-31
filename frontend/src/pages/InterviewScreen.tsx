import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as faceapi from '@vladmandic/face-api'
import { getNextQuestion, submitAnswer } from '../api/api'
import '../styles/InterviewScreen.css'

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}
interface SpeechRecognitionResultList { length: number; [index: number]: SpeechRecognitionResult }
interface SpeechRecognitionResult { isFinal: boolean; [index: number]: SpeechRecognitionAlternative }
interface SpeechRecognitionAlternative { transcript: string }
interface SpeechRecognitionInterface extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void; stop(): void; abort(): void
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInterface
    webkitSpeechRecognition: new () => SpeechRecognitionInterface
  }
}

type PermissionState = 'pending' | 'granted' | 'denied'
type ViolationType = 'multiple_faces' | 'no_face' | null

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
  scenario: '🟣 Scenario',
}

function InterviewScreen() {
  const [permissionState, setPermissionState] = useState<PermissionState>('pending')
  const [permissionError, setPermissionError] = useState('')

  const [question, setQuestion] = useState('')
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [difficulty, setDifficulty] = useState('medium')
  const [timeLeft, setTimeLeft] = useState(60)
  const [totalTime, setTotalTime] = useState(60)
  const [answer, setAnswer] = useState('')
  const [interimAnswer, setInterimAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)   // AI reading question
  const [revealedText, setRevealedText] = useState('')   // word-by-word reveal
  const [error, setError] = useState('')

  // Proctoring
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false)
  const [violation, setViolation] = useState<ViolationType>(null)
  const [violationWarning, setViolationWarning] = useState('')
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
  const answerRef = useRef('')
  const interimRef = useRef('')
  const autoSubmitRef = useRef<() => void>(() => {})
  const violationCountRef = useRef(0)
  const violationActiveRef = useRef(false)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consecutiveBadFrames = useRef(0)   // must fail N checks in a row
  const isSpeakingRef = useRef(false)
  const tabSwitchCount = useRef(0)          // tab switch violation counter

  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { interimRef.current = interimAnswer }, [interimAnswer])
  useEffect(() => { isSpeakingRef.current = isSpeaking }, [isSpeaking])

  // ── Tab switch / window blur detection ────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return  // only care about leaving
      tabSwitchCount.current += 1
      const count = tabSwitchCount.current

      if (count === 1) {
        // First offence — warning
        setViolationWarning('🚨 Tab switch detected! Switching tabs is not allowed. Next violation will terminate the exam.')
        setViolation('multiple_faces')  // reuse banner styling
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
        warningTimerRef.current = setTimeout(() => {
          setViolation(null); setViolationWarning('')
        }, 8000)
      } else {
        // Second offence — terminate
        setExamTerminated(true)
        if (timerRef.current) clearInterval(timerRef.current)
        if (faceCheckRef.current) clearInterval(faceCheckRef.current)
        if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
        window.speechSynthesis?.cancel()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Load face models
  useEffect(() => {
    faceapi.nets.tinyFaceDetector.loadFromUri('/models')
      .then(() => setFaceModelsLoaded(true))
      .catch(e => console.warn('[proctoring] model load failed:', e))
  }, [])

  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [permissionState])

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
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      }, 100)
      setPermissionState('granted')
      initSpeechRecognition()
      loadNextQuestion()
    } catch (err: any) {
      setPermissionState('denied')
      if (err.name === 'NotAllowedError') setPermissionError('Camera and microphone access was denied.')
      else if (err.name === 'NotFoundError') setPermissionError('No camera or microphone found.')
      else setPermissionError(`Could not access camera/microphone: ${err.message}`)
    }
  }

  // Face detection loop
  useEffect(() => {
    if (!faceModelsLoaded || permissionState !== 'granted') return
    // Check every 5 seconds, high threshold to avoid false positives
    faceCheckRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        const detections = await faceapi.detectAllFaces(
          videoRef.current,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.75 })
        )
        handleFaceCount(detections.length)
      } catch {}
    }, 5000)
    return () => { if (faceCheckRef.current) clearInterval(faceCheckRef.current) }
  }, [faceModelsLoaded, permissionState, examTerminated])

  const handleFaceCount = useCallback((count: number) => {
    if (count === 1) {
      // Good frame — reset consecutive counter and clear any active warning
      consecutiveBadFrames.current = 0
      if (violationActiveRef.current) {
        violationActiveRef.current = false
        setViolation(null); setViolationWarning('')
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      }
      return
    }

    // Bad frame — only warn after 5 consecutive bad frames (5 × 5s = 25s of being absent)
    consecutiveBadFrames.current += 1
    if (consecutiveBadFrames.current < 5) return

    const type: ViolationType = count === 0 ? 'no_face' : 'multiple_faces'
    if (violationActiveRef.current) return
    violationActiveRef.current = true
    consecutiveBadFrames.current = 0
    violationCountRef.current += 1
    const newCount = violationCountRef.current
    setViolationCount(newCount)
    const message = count === 0
      ? `⚠️ You are not visible on camera. (Warning ${newCount}/3)`
      : `🚨 Another person detected in frame. (Warning ${newCount}/3)`
    setViolation(type); setViolationWarning(message)

    // PROCTORING TERMINATION DISABLED — re-enable when ready
    // if (newCount >= 3) { ... }

    warningTimerRef.current = setTimeout(() => {
      violationActiveRef.current = false
      setViolation(null); setViolationWarning('')
    }, 15000)
  }, [])

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (faceCheckRef.current) clearInterval(faceCheckRef.current)
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    window.speechSynthesis?.cancel()
  }

  const initSpeechRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''; let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalText += result[0].transcript
        else interimText += result[0].transcript
      }
      if (finalText) setAnswer(prev => prev ? prev + ' ' + finalText.trim() : finalText.trim())
      setInterimAnswer(interimText)
    }
    recognition.onerror = () => setIsRecording(false)
    recognition.onend = () => { setIsRecording(false); setInterimAnswer('') }
    recognitionRef.current = recognition
  }

  // ── AI reads question aloud + reveals text word by word ───────────────
  const speakQuestion = (text: string, onDone: () => void) => {
    if (!window.speechSynthesis) { setRevealedText(text); onDone(); return }
    window.speechSynthesis.cancel()
    setRevealedText('')

    const words = text.split(' ')
    const rate = 0.92
    // Average speaking rate ~150 wpm at rate=1, scaled by our rate
    const msPerWord = (60 / (150 * rate)) * 1000  // ~435ms per word

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = 1
    utterance.lang = 'en-US'
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang === 'en-US' && v.name.includes('Google'))
      || voices.find(v => v.lang === 'en-US')
    if (preferred) utterance.voice = preferred

    // Timer-based word reveal — doesn't rely on onboundary (broken in Chrome)
    let wordIndex = 0
    const revealInterval = setInterval(() => {
      wordIndex += 1
      setRevealedText(words.slice(0, wordIndex).join(' '))
      if (wordIndex >= words.length) clearInterval(revealInterval)
    }, msPerWord)

    utterance.onend = () => {
      clearInterval(revealInterval)
      setRevealedText(text)   // ensure full text shown
      setIsSpeaking(false)
      onDone()
    }
    utterance.onerror = () => {
      clearInterval(revealInterval)
      setRevealedText(text)
      setIsSpeaking(false)
      onDone()
    }

    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  // ── Timer — only starts after AI finishes speaking ─────────────────────
  const startTimer = (seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!); timerRef.current = null
          autoSubmitRef.current()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // ── Load question ──────────────────────────────────────────────────────
  const loadNextQuestion = async () => {
    setLoading(true); setError('')
    setAnswer(''); setInterimAnswer(''); setRevealedText('')
    if (timerRef.current) clearInterval(timerRef.current)
    window.speechSynthesis?.cancel()
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch {}; setIsRecording(false) }
    initSpeechRecognition()
    try {
      const data = await getNextQuestion(sessionId!)
      setQuestion(data.question)
      setQuestionNumber(data.question_number)
      setTotalQuestions(data.total_questions)
      setDifficulty(data.difficulty || 'medium')
      setTotalTime(data.time_limit)
      setTimeLeft(data.time_limit)
      setLoading(false)
      // AI reads question first, then timer starts
      speakQuestion(data.question, () => startTimer(data.time_limit))
    } catch (err: any) {
      if (err.response?.status === 400) navigate('/result')
      else setError(err.response?.data?.detail || 'Failed to load question')
      setLoading(false)
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true; setIsSubmitting(true)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    window.speechSynthesis?.cancel()
    if (recognitionRef.current) { try { recognitionRef.current.abort() } catch {}; setIsRecording(false) }
    const finalAnswer = (answerRef.current + ' ' + interimRef.current).trim() || 'No answer provided'
    try {
      const result = await submitAnswer(sessionId!, questionNumber, finalAnswer)
      if (result.is_last_question) navigate('/result')
      else await loadNextQuestion()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit answer')
    } finally {
      setIsSubmitting(false); isSubmittingRef.current = false
    }
  }

  useEffect(() => { autoSubmitRef.current = handleSubmit })

  const toggleRecording = () => {
    if (isSpeakingRef.current) return // don't record while AI is speaking
    if (!recognitionRef.current) { setError('Speech recognition not supported. Please type your answer.'); return }
    if (isRecording) {
      try { recognitionRef.current.stop() } catch {}; setIsRecording(false)
    } else {
      setAnswer(''); setInterimAnswer('')
      try {
        recognitionRef.current.abort()
        setTimeout(() => { try { recognitionRef.current?.start(); setIsRecording(true) } catch {} }, 100)
      } catch {}
    }
  }

  const timerPercent = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0
  const timerColor = timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#10b981'

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

  // PROCTORING TERMINATION DISABLED
  // if (examTerminated) { ... }

  if (examTerminated) {
    return (
      <div className="interview-container">
        <div className="permission-gate denied">
          <div className="permission-icon">🚫</div>
          <h2>Exam Terminated</h2>
          <p>Your exam has been terminated due to a proctoring violation.</p>
          <p style={{ marginTop: '8px', color: '#ef4444', fontWeight: 600 }}>
            Tab switching was detected more than once.
          </p>
          <button className="btn-submit" style={{ marginTop: '24px' }}
            onClick={() => { localStorage.removeItem('sessionId'); navigate('/') }}>
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="interview-container">
      {violationWarning && (
        <div className={`violation-banner ${violation === 'multiple_faces' ? 'danger' : 'warning'}`}>
          {violationWarning}
        </div>
      )}

      <div className="interview-header">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(questionNumber / totalQuestions) * 100}%` }} />
        </div>
        <div className="question-counter">
          Question {questionNumber} of {totalQuestions}
          <span className="difficulty-badge">{DIFFICULTY_LABEL[difficulty] || difficulty}</span>
        </div>
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
          {violationCount > 0 && <div className="violation-counter">⚠️ {violationCount}/3 warnings</div>}
        </div>

        <div className="interview-content">
          {loading || isSubmitting ? (
            <div className="loading">{isSubmitting ? 'Submitting...' : 'Loading next question...'}</div>
          ) : (
            <>
              <div className="question-box">
                <div className="question-label">
                  QUESTION:
                  {isSpeaking && <span className="speaking-indicator"> 🔊 AI IS READING...</span>}
                </div>
                <div className="question-text">
                  {revealedText || '\u00A0'}
                  {isSpeaking && <span className="cursor-blink">|</span>}
                </div>
              </div>

              {/* Dynamic circular timer */}
              <div className="timer">
                <svg className="timer-svg" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={isSpeaking ? '#a78bfa' : timerColor}
                    strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={isSpeaking ? 0 : `${2 * Math.PI * 34 * (1 - timerPercent / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                  />
                </svg>
                <div className="timer-text" style={{ color: isSpeaking ? '#7c3aed' : timerColor }}>
                  {isSpeaking ? '🔊' : `${timeLeft}s`}
                </div>
              </div>

              {isSpeaking && (
                <p className="speaking-hint">AI is reading the question aloud. Timer starts when done.</p>
              )}

              <div className="answer-section">
                <textarea
                  className="answer-input"
                  placeholder={isSpeaking ? 'Wait for AI to finish reading...' : 'Speak using the mic or type your answer here...'}
                  value={answer + (interimAnswer ? ' ' + interimAnswer : '')}
                  onChange={e => setAnswer(e.target.value)}
                  disabled={isSubmitting || isSpeaking}
                />
                <div className="controls">
                  <button
                    className={`btn-mic ${isRecording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    disabled={isSubmitting || isSpeaking}
                    title={isSpeaking ? 'Wait for AI to finish reading' : ''}
                  >
                    {isRecording ? '🔴 Stop' : '🎤 Record'}
                  </button>
                  <button className="btn-submit" onClick={handleSubmit} disabled={isSubmitting || isSpeaking}>
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
