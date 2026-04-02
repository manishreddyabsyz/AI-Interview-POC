import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { startInterview } from '../api/api'
import '../styles/StartInterview.css'

function StartInterview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  useEffect(() => {
    if (!sessionId) navigate('/')
  }, [sessionId, navigate])

  const handleStart = async () => {
    setLoading(true); setError('')
    try {
      await startInterview(sessionId!)
      navigate('/interview')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start interview')
      setLoading(false)
    }
  }

  return (
    <div className="start-page">
      <div className="start-card">
        <div className="start-badge">Ready</div>
        <h1>Your Interview is Set</h1>
        <p className="start-sub">
          Questions are generated from your resume and job description.
          The AI will read each question aloud — listen, then answer verbally.
        </p>

        <div className="checklist">
          <div className="check-item">
            <div className="check-icon accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div>
              <strong>JD + Resume matched</strong>
              <p>Questions are tailored to the role requirements and your experience</p>
            </div>
          </div>
          <div className="check-item">
            <div className="check-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
            </div>
            <div>
              <strong>Voice-over questions</strong>
              <p>Each question is read aloud — recording starts automatically after</p>
            </div>
          </div>
          <div className="check-item">
            <div className="check-icon success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <strong>Adaptive timer</strong>
              <p>Time per question is set based on its complexity — no fixed countdown</p>
            </div>
          </div>
        </div>

        {error && <div className="start-error">{error}</div>}

        <button className="btn-begin" onClick={handleStart} disabled={loading}>
          {loading ? (
            <><span className="spinner-sm" /> Generating questions…</>
          ) : (
            <>Start Interview<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg></>
          )}
        </button>

        {loading && <p className="start-hint">Analysing your documents and preparing questions — this may take a minute…</p>}
      </div>
    </div>
  )
}

export default StartInterview
