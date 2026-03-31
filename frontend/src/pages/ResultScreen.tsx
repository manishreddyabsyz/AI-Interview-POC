import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFinalResult } from '../api/api'
import type { FinalReport } from '../types'
import '../styles/ResultScreen.css'

const REC_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'strong hire': { color: '#065f46', bg: '#d1fae5', icon: '🌟' },
  'hire':        { color: '#065f46', bg: '#d1fae5', icon: '✅' },
  'maybe':       { color: '#92400e', bg: '#fef3c7', icon: '🤔' },
  'no hire':     { color: '#991b1b', bg: '#fee2e2', icon: '❌' },
}

function getRecConfig(rec: string) {
  const key = Object.keys(REC_CONFIG).find(k => rec.toLowerCase().includes(k))
  return key ? REC_CONFIG[key] : { color: '#374151', bg: '#f3f4f6', icon: '📋' }
}

function ScoreRing({ score }: { score: number }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const fill = circ * (score / 100)
  const color = score >= 65 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444'
  return (
    <div className="score-ring-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${fill} ${circ - fill}`}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="score-ring-inner">
        <span className="score-ring-num" style={{ color }}>{Math.round(score)}</span>
        <span className="score-ring-sub">/ 100</span>
      </div>
    </div>
  )
}

function ResultScreen() {
  const [result, setResult] = useState<FinalReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const sessionId = localStorage.getItem('sessionId')

  useEffect(() => {
    if (!sessionId) { navigate('/'); return }
    getFinalResult(sessionId!)
      .then(data => setResult(data))
      .catch(err => setError(err.response?.data?.detail || 'Failed to load results'))
      .finally(() => setLoading(false))
  }, [])

  const handleRestart = () => {
    localStorage.removeItem('sessionId')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="result-page">
        <div className="result-loading-card">
          <div className="result-spinner" />
          <p>Evaluating your answers and generating report...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="result-page">
        <div className="result-loading-card">
          <p className="result-error">{error}</p>
          <button className="btn-restart" onClick={handleRestart}>Start Over</button>
        </div>
      </div>
    )
  }

  const rec = getRecConfig(result!.recommendation)
  const scoreColor = result!.overall_score >= 65 ? '#10b981' : result!.overall_score >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="result-page">
      <div className="result-wrapper">

        {/* Header */}
        <div className="result-header">
          <h1>Interview Complete</h1>
          <p>{result!.total_questions} questions answered</p>
        </div>

        {/* Score + Recommendation row */}
        <div className="result-hero">
          <ScoreRing score={result!.overall_score} />
          <div className="result-hero-right">
            <div className="rec-pill" style={{ color: rec.color, background: rec.bg }}>
              {rec.icon} {result!.recommendation}
            </div>
            <p className="result-summary">{result!.summary}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="result-stats">
          <div className="stat-card">
            <span className="stat-num" style={{ color: scoreColor }}>{Math.round(result!.overall_score)}%</span>
            <span className="stat-lbl">Overall Score</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{result!.total_questions}</span>
            <span className="stat-lbl">Questions</span>
          </div>
          <div className="stat-card">
            <span className="stat-num" style={{ color: scoreColor }}>
              {result!.overall_score >= 65 ? 'Pass' : 'Needs Work'}
            </span>
            <span className="stat-lbl">Status</span>
          </div>
        </div>

        {/* Strengths + Weaknesses */}
        <div className="result-two-col">
          <div className="result-panel green">
            <div className="panel-title">💪 Strengths</div>
            <ul>
              {result!.strengths.map((s, i) => (
                <li key={i}><span className="check">✓</span>{s}</li>
              ))}
            </ul>
          </div>
          <div className="result-panel red">
            <div className="panel-title">📈 Areas to Improve</div>
            <ul>
              {result!.weaknesses.map((w, i) => (
                <li key={i}><span className="arrow">→</span>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Topic scores */}
        {result!.topic_scores && Object.keys(result!.topic_scores).length > 0 && (
          <div className="result-panel full">
            <div className="panel-title">📊 Score by Topic</div>
            <div className="topic-list">
              {Object.entries(result!.topic_scores).map(([topic, score]) => {
                const pct = Math.round((score / 10) * 100)
                const c = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
                return (
                  <div key={topic} className="topic-row">
                    <span className="topic-name">{topic}</span>
                    <div className="topic-track">
                      <div className="topic-fill" style={{ width: `${pct}%`, background: c }} />
                    </div>
                    <span className="topic-val" style={{ color: c }}>{score}/10</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Advice */}
        {result!.advice && (
          <div className="result-advice">
            <span className="advice-icon">💡</span>
            <p>{result!.advice}</p>
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <button className="btn-restart" onClick={handleRestart}>
            🔄 Start New Interview
          </button>
        </div>

      </div>
    </div>
  )
}

export default ResultScreen
