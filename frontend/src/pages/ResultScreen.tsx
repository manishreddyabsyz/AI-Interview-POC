import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFinalResult } from '../api/api'
import '../styles/ResultScreen.css'

interface Result {
  overall_score: number
  recommendation: string
  summary: string
  strengths: string[]
  weaknesses: string[]
  total_questions: number
}

function ResultScreen() {
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  useEffect(() => {
    if (!sessionId) {
      navigate('/')
      return
    }
    loadResult()
  }, [navigate, sessionId])

  const loadResult = async () => {
    try {
      const data = await getFinalResult(sessionId!)
      setResult(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  const handleRestart = () => {
    localStorage.removeItem('sessionId')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="loading">Generating your report...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="error">{error}</div>
          <button className="btn-primary" onClick={handleRestart}>
            Start Over
          </button>
        </div>
      </div>
    )
  }

  const getRecommendationColor = (rec: string): string => {
    if (rec.toLowerCase().includes('hire') && !rec.toLowerCase().includes('no')) return '#10b981'
    if (rec.toLowerCase().includes('no')) return '#ef4444'
    return '#f59e0b'
  }

  return (
    <div className="container">
      <div className="result-card">
        <h1>Interview Complete! 🎉</h1>
        
        <div className="score-circle">
          <div className="score-value">{Math.round(result.overall_score)}</div>
          <div className="score-label">out of 100</div>
        </div>

        <div 
          className="recommendation"
          style={{ backgroundColor: getRecommendationColor(result.recommendation) }}
        >
          {result.recommendation}
        </div>

        <div className="summary-box">
          <p>{result.summary}</p>
        </div>

        <div className="details-grid">
          <div className="detail-section">
            <h3>💪 Strengths</h3>
            <ul>
              {result.strengths.map((strength, index) => (
                <li key={index}>{strength}</li>
              ))}
            </ul>
          </div>

          <div className="detail-section">
            <h3>📈 Areas to Improve</h3>
            <ul>
              {result.weaknesses.map((weakness, index) => (
                <li key={index}>{weakness}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="stats">
          <div className="stat-item">
            <div className="stat-value">{result.total_questions}</div>
            <div className="stat-label">Questions Answered</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{Math.round(result.overall_score)}%</div>
            <div className="stat-label">Success Rate</div>
          </div>
        </div>

        <button className="btn-primary" onClick={handleRestart}>
          Start New Interview
        </button>
      </div>
    </div>
  )
}

export default ResultScreen
