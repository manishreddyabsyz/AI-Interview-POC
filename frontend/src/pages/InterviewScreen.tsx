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

type Stage = 'loading' | 'speaking' | 'preparing' | 'recording' | 'submitting'
type ViolationType = 'multiple_faces' | 'no_face' | null
type PermissionState = 'pending' | 'granted' | 'denied'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880; osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

function InterviewScreen() {
  const [permissionState, setPermissionState] = useState<PermissionState>('pending')
  const [permissionError, setPermissionError] = useState('')
  const [stage, setStage] = useState<Stage>('loading')
  const [question, setQuestion] = useState('')
  const [questionNumber, setQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(5)
  const [answer, setAnswer] = useState('')
  const [interimAnswer, setInterimAnswer] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [prepCount, setPrepCount] = useState(5)
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
  const prepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const faceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answerRef = useRef('')
  const interimRef = useRef('')
  const isSubmittingRef = useRef(false)
  const violationCountRef = useRef(0)
  const violationActiveRef = useRef(false)
  const autoSubmitRef = useRef<() => void>(() => {})
  const estimatedTimeRef = useRef(60)

  useEffect(() => { answerRef.current = answer }, [answer])
  useEffect(() => { interimRef.current = interimAnswer }, [interimAnswer])

  // ── Face models ──────────────────────────────────────────────────────
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
      else setPermissionError(`Could not access devices: ${err.message}`)
    }
  }

  // ── Face detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!faceModelsLoaded || permissionState !== 'granted' || examTerminated) return
    faceCheckRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return
      try {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
        handleFaceCount(detections.length)
      } catch {}
    }, 1500)
    return () => { if (faceCheckRef.current) clearInterval(faceCheckRef.current) }
  }, [faceModelsLoaded, permissionState, examTerminated])

  const handleFaceCount = useCallback((count: number) => {
    if (count === 1) {
      if (violationActiveRef.current) {
        violationActiveRef.current = false; setViolation(null); setViolationWarning('')
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
      }
      return
    }
    if (violationActiveRef.current) return
    violationActiveRef.current = true
    violationCountRef.current += 1
    const newCount = violationCountRef.current
    setViolationCount(newCount)
    const type: ViolationType = count === 0 ? 'no_face' : 'multiple_faces'
    setViolation(type)
    setViolationWarning(count === 0
      ? `⚠ You are not visible on camera. (Warning ${newCount}/3)`
      : `⚠ Another person detected. (Warning ${newCount}/3)`)
    if (newCount >= 3) {
      setExamTerminated(true)
      if (faceCheckRef.current) clearInterval(faceCheckRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      if (prepTimerRef.current) clearInterval(prepTimerRef.current)
      if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
      return
    }
    warningTimerRef.current = setTimeout(() => {
      violationActiveRef.current = false; setViolation(null); setViolationWarning('')
    }, 5000)
  }, [])

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (prepTimerRef.current) clearInterval(prepTimerRef.current)
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
    recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'en-US'
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''; let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      if (finalText) setAnswer(prev => prev ? prev + ' ' + finalText.trim() : finalText.trim())
      setInterimAnswer(interimText)
    }
    recognition.onerror = () => {}
    recognition.onend = () => setInterimAnswer('')
    recognitionRef.current = recognition
  }

  // ── Speak question via TTS ──────────────────────────────────────────
  const speakQuestion = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.92; utterance.pitch = 1; utterance.volume = 1
    utterance.onend = () => startPrepCountdown()
    utterance.onerror = () => startPrepCountdown()
    window.speechSynthesis.speak(utterance)
  }

  // ── 5s prep countdown ───────────────────────────────────────────────
  const startPrepCountdown = () => {
    setStage('preparing')
    let count = 5; setPrepCount(5)
    if (prepTimerRef.current) clearInterval(prepTimerRef.current)
    prepTimerRef.current = setInterval(() => {
      count -= 1; setPrepCount(count)
      if (count <= 0) {
        clearInterval(prepTimerRef.current!)
        prepTimerRef.current = null
        playBeep()
        startRecording()
      }
    }, 1000)
  }

  // ── Start recording + answer timer ──────────────────────────────────
  const startRecording = () => {
    setStage('recording')
    setAnswer(''); setInterimAnswer('')
    answerRef.current = ''; interimRef.current = ''
    initSpeechRecognition()
    try { recognitionRef.current?.start() } catch {}

    const totalTime = estimatedTimeRef.current + 10
    setTimeLeft(totalTime)
    if (timerRef.current) clearInterval(timerRef.current)
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

  // ── Load question ────────────────────────────────────────────────────
  const loadNextQuestion = async () => {
    setStage('loading'); setError(''); setAnswer(''); setInterimAnswer('')
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (prepTimerRef.current) { clearInterval(prepTimerRef.current); prepTimerRef.current = null }
    if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
    window.speechSynthesis?.cancel()
    try {
      const data = await getNextQuestion(sessionId!)
      estimatedTimeRef.current = data.estimated_time || 60
      setQuestion(data.question)
      setQuestionNumber(data.question_number)
      setTotalQuestions(data.total_questions)
      setStage('speaking')
      setTimeout(() => speakQuestion(data.question), 400)
    } catch (err: any) {
      if (err.response?.status === 400) navigate('/result')
      else setError(err.response?.data?.detail || 'Failed to load question')
    }
  }

  // ── Submit answer ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setStage('submitting')
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (recognitionRef.current) try { recognitionRef.current.abort() } catch {}
    window.speechSynthesis?.cancel()
    const finalAnswer = (answerRef.current + ' ' + interimRef.current).trim() || 'No answer provided'
    try {
      const result = await submitAnswer(sessionId!, questionNumber, finalAnswer)
      if (result.is_last_question) navigate('/result')
      else { isSubmittingRef.current = false; await loadNextQuestion() }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit answer')
      isSubmittingRef.current = false; setStage('recording')
    }
  }

  useEffect(() => { autoSubmitRef.current = handleSubmit })

  const progress = totalQuestions > 0 ? ((questionNumber - 1) / totalQuestions) * 100 : 0
  const timerPct = estimatedTimeRef.current > 0 ? (timeLeft / (estimatedTimeRef.current + 10)) * 100 : 100

  // ── Permission / terminated gates ────────────────────────────────────
  if (permissionState === 'pending') return (
    <div className="iv-page"><div className="iv-gate"><div className="gate-spinner" /><h2>Requesting access…</h2><p>Allow camera and microphone to continue</p></div></div>
  )
  if (permissionState === 'denied') return (
    <div className="iv-page"><div className="iv-gate"><h2>Access Denied</h2><p>{permissionError}</p><p className="gate-hint">Click the camera icon in your browser's address bar, then refresh.</p><button className="btn-gate" onClick={() => window.location.reload()}>Retry</button></div></div>
  )
  if (examTerminated) return (
    <div className="iv-page"><div className="iv-gate danger"><h2>Interview Terminated</h2><p>Repeated proctoring violations detected ({violationCount}/3 warnings).</p><button className="btn-gate" onClick={() => { localStorage.removeItem('sessionId'); navigate('/') }}>Return Home</button></div></div>
  )

  return (
    <div className="iv-page">
      {violationWarning && (
        <div className={`violation-banner ${violation === 'multiple_faces' ? 'danger' : 'warning'}`}>{violationWarning}</div>
      )}

      {/* Top bar */}
      <div className="iv-topbar">
        <div className="iv-progress-track">
          <div className="iv-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="iv-counter">Q {questionNumber} / {totalQuestions}</div>
      </div>

      <div className="iv-body">
        {/* Camera panel */}
        <div className="iv-camera-panel">
          <div className={`iv-camera-wrap ${violation ? 'violated' : ''}`}>
            <video ref={videoRef} autoPlay muted playsInline className="iv-video" />
            <canvas ref={canvasRef} className="iv-canvas" />
            <div className={`iv-cam-badge ${stage === 'recording' ? 'rec' : ''} ${violation ? 'vio' : ''}`}>
              {violation === 'multiple_faces' ? '⚠ Multiple faces'
               : violation === 'no_face' ? '⚠ Not visible'
               : stage === 'recording' ? '● REC'
               : stage === 'speaking' ? '♦ Listening'
               : stage === 'preparing' ? '◌ Prepare'
               : '◎ Live'}
            </div>
          </div>
          {violationCount > 0 && <div className="iv-warn-count">⚠ {violationCount} / 3 warnings</div>}
        </div>

        {/* Main content */}
        <div className="iv-content">

          {stage === 'loading' && (
            <div className="iv-state-center">
              <div className="pulse-ring" />
              <p>Loading next question…</p>
            </div>
          )}

          {stage === 'submitting' && (
            <div className="iv-state-center">
              <div className="pulse-ring" />
              <p>Processing your answer…</p>
            </div>
          )}

          {(stage === 'speaking' || stage === 'preparing' || stage === 'recording') && (
            <>
              <div className="iv-question-box">
                <div className="iv-q-label">Question {questionNumber}</div>
                <div className="iv-q-text">{question}</div>
              </div>

              {stage === 'speaking' && (
                <div className="iv-speaking">
                  <div className="sound-wave">
                    {[1,2,3,4,5].map(i => <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />)}
                  </div>
                  <p>Listening to question…</p>
                </div>
              )}

              {stage === 'preparing' && (
                <div className="iv-preparing">
                  <div className="prep-count">{prepCount}</div>
                  <p>Get ready to answer</p>
                </div>
              )}

              {stage === 'recording' && (
                <div className="iv-recording-zone">
                  <div className="iv-timer-row">
                    <div className="iv-timer-bar-track">
                      <div className="iv-timer-bar-fill" style={{ width: `${timerPct}%`, background: timerPct > 40 ? 'var(--accent)' : timerPct > 15 ? 'var(--warning)' : 'var(--danger)' }} />
                    </div>
                    <span className="iv-timer-label">{timeLeft}s</span>
                  </div>

                  <textarea
                    className="iv-answer"
                    placeholder="Your spoken answer will appear here…"
                    value={answer + (interimAnswer ? ' ' + interimAnswer : '')}
                    onChange={e => setAnswer(e.target.value)}
                  />

                  <div className="iv-controls">
                    <div className="rec-indicator">
                      <span className="rec-dot" />
                      <span>Recording…</span>
                    </div>
                    <button className="btn-next" onClick={handleSubmit}>
                      {questionNumber < totalQuestions ? 'Next Question' : 'Finish Interview'}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {error && <div className="iv-error">{error}</div>}
        </div>
      </div>
    </div>
  )
}

export default InterviewScreen
