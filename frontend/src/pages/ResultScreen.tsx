import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFinalResult } from '../api/api'
import type { FinalReport } from '../types'
import '../styles/ResultScreen.css'

function ResultScreen() {
  const [result, setResult] = useState<FinalReport | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
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
          <div className="loading">Evaluating your answers and generating report...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="error">{error}</div>
          <button className="btn-primary" onClick={handleRestart}>Start Over</button>
        </div>
      </div>
    )
  }

  const getRecommendationColor = (rec: string): string => {
    const r = rec.toLowerCase()
    if (r.includes('strong hire')) return '#059669'
    if (r.includes('hire') && !r.includes('no')) return '#10b981'
    if (r.includes('no hire')) return '#ef4444'
    return '#f59e0b'
  }

  return (
    <div className="container">
      <div className="result-card">
        <h1>Interview Complete 🎉</h1>

        <div className="score-circle">
          <div className="score-value">{Math.round(result!.overall_score)}</div>
          <div className="score-label">out of 100</div>
        </div>

        <div
          className="recommendation"
          style={{ backgroundColor: getRecommendationColor(result!.recommendation) }}
        >
          {result!.recommendation}
        </div>

        <div className="summary-box">
          <p>{result!.summary}</p>
        </div>

        <div className="details-grid">
          <div className="detail-section">
            <h3>💪 Strengths</h3>
            <ul>
              {result!.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="detail-section">
            <h3>📈 Areas to Improve</h3>
            <ul>
              {result!.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>

        {/* Topic-wise scores */}
        {result!.topic_scores && Object.keys(result!.topic_scores).length > 0 && (
          <div className="topic-scores">
            <h3>📊 Score by Topic</h3>
            {Object.entries(result!.topic_scores).map(([topic, score]) => (
              <div key={topic} className="topic-row">
                <span className="topic-name">{topic}</span>
                <div className="topic-bar-bg">
                  <div
                    className="topic-bar-fill"
                    style={{ width: `${(score / 10) * 100}%`, backgroundColor: score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444' }}
                  />
                </div>
                <span className="topic-score">{score}/10</span>
              </div>
            ))}
          </div>
        )}

        {/* Personalized advice */}
        {result!.advice && (
          <div className="advice-box">
            <h3>💡 Advice</h3>
            <p>{result!.advice}</p>
          </div>
        )}

        <div className="stats">
          <div className="stat-item">
            <div className="stat-value">{result!.total_questions}</div>
            <div className="stat-label">Questions Answered</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{Math.round(result!.overall_score)}%</div>
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
