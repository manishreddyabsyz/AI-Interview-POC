import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { startInterview } from '../api/api'
import '../styles/StartInterview.css'

function StartInterview() {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
  }, [sessionId, navigate])

  const handleStart = async () => {
    setLoading(true)
    setError('')

    try {
      await startInterview(sessionId!)
      navigate('/interview')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to start interview')
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="icon-large">🎯</div>
        <h1>Ready to Start?</h1>
        <p className="subtitle">
          Your interview will consist of 5 technical questions based on your resume.
          All questions will be generated upfront for a smooth experience.
        </p>

        <div className="info-box">
          <div className="info-item">
            <span className="info-icon">⏱️</span>
            <div>
              <strong>30 seconds per question</strong>
              <p>Auto-advances to next question when time runs out</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">🎤</span>
            <div>
              <strong>Voice or Text</strong>
              <p>Use microphone or type your answers</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">📊</span>
            <div>
              <strong>Final Evaluation</strong>
              <p>Get comprehensive feedback after completing all questions</p>
            </div>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button
          className="btn-primary"
          onClick={handleStart}
          disabled={loading}
        >
          {loading ? 'Generating questions... (this may take 1-2 minutes)' : 'Start AI Interview'}
        </button>
        
        {loading && (
          <p style={{ marginTop: '15px', color: '#667eea', fontSize: '0.9rem' }}>
            Please wait while we generate all 5 questions for you...
          </p>
        )}
      </div>
    </div>
  )
}

export default StartInterview
