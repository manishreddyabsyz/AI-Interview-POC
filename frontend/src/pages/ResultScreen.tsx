import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFinalResult } from '../api/api'
import type { FinalReport } from '../types'
import '../styles/ResultScreen.css'

function generatePDF(result: FinalReport) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const scoreColor = result.overall_score >= 65 ? '#10b981' : result.overall_score >= 50 ? '#f59e0b' : '#ef4444'
  const recColor = result.recommendation.toLowerCase().includes('no hire') ? '#ef4444'
    : result.recommendation.toLowerCase().includes('hire') ? '#10b981' : '#f59e0b'

  const qaRows = (result.qa_history || []).map((qa, i) => `
    <div class="qa-block">
      <div class="qa-header">
        <span>Q${i + 1} &nbsp;|&nbsp; ${qa.topic} &nbsp;|&nbsp; Score: ${qa.score}/10</span>
        <span class="qa-score-badge" style="background:${qa.score >= 7 ? '#10b981' : qa.score >= 5 ? '#f59e0b' : '#ef4444'}">${qa.score}/10</span>
      </div>
      <p class="qa-question"><strong>Q:</strong> ${qa.question}</p>
      <p class="qa-answer"><strong>A:</strong> ${qa.answer && qa.answer !== 'No answer provided' ? qa.answer : '<em>No answer provided</em>'}</p>
      ${qa.feedback && qa.feedback !== 'Pending evaluation.' ? `<p class="qa-feedback"><strong>Feedback:</strong> ${qa.feedback}</p>` : ''}
    </div>
  `).join('')

  const topicScoreRows = result.topic_scores
    ? Object.entries(result.topic_scores).map(([topic, score]) => `
        <tr>
          <td>${topic}</td>
          <td>
            <div class="bar-bg"><div class="bar-fill" style="width:${(score/10)*100}%;background:${score>=7?'#10b981':score>=5?'#f59e0b':'#ef4444'}"></div></div>
          </td>
          <td style="text-align:right;font-weight:600">${score}/10</td>
        </tr>`).join('')
    : ''

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Interview Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; background: #fff; }
    .header { background: #667eea; color: white; padding: 20px 30px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p { font-size: 11px; opacity: 0.85; }
    .content { padding: 24px 30px; }
    .score-row { display: flex; align-items: center; gap: 20px; margin-bottom: 16px; }
    .score-circle { width: 70px; height: 70px; border-radius: 50%; background: ${scoreColor}; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; }
    .score-circle .num { font-size: 22px; font-weight: bold; line-height: 1; }
    .score-circle .lbl { font-size: 9px; }
    .rec-badge { padding: 6px 16px; border-radius: 20px; background: ${recColor}; color: white; font-weight: bold; font-size: 13px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 10px; }
    .summary-box { background: #f9fafb; border-left: 4px solid #667eea; padding: 10px 14px; border-radius: 4px; line-height: 1.6; color: #4b5563; }
    .qa-block { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
    .qa-header { background: #f3f4f6; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 11px; color: #667eea; }
    .qa-score-badge { color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px; }
    .qa-question { padding: 8px 12px 4px; line-height: 1.5; }
    .qa-answer { padding: 4px 12px; color: #374151; line-height: 1.5; }
    .qa-feedback { padding: 4px 12px 8px; color: #6b7280; font-size: 11px; line-height: 1.5; font-style: italic; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .strength-item { color: #374151; padding: 3px 0; }
    .strength-item::before { content: "✓ "; color: #10b981; font-weight: bold; }
    .weakness-item { color: #374151; padding: 3px 0; }
    .weakness-item::before { content: "→ "; color: #ef4444; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 5px 8px; vertical-align: middle; }
    .bar-bg { background: #e5e7eb; border-radius: 4px; height: 8px; }
    .bar-fill { height: 8px; border-radius: 4px; }
    .advice-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 4px; color: #1e40af; line-height: 1.6; }
    .footer { text-align: center; color: #9ca3af; font-size: 10px; margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .qa-block { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>AI Interview Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  <div class="content">
    <div class="score-row">
      <div class="score-circle"><span class="num">${Math.round(result.overall_score)}</span><span class="lbl">/ 100</span></div>
      <div>
        <div class="rec-badge">${result.recommendation}</div>
        <p style="margin-top:6px;color:#6b7280;font-size:11px">${result.total_questions} questions answered</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Summary</div>
      <div class="summary-box">${result.summary}</div>
    </div>

    <div class="section">
      <div class="section-title">Questions &amp; Answers</div>
      ${qaRows || '<p style="color:#9ca3af">No Q&amp;A data available.</p>'}
    </div>

    ${topicScoreRows ? `
    <div class="section">
      <div class="section-title">Score by Topic</div>
      <table>${topicScoreRows}</table>
    </div>` : ''}

    <div class="section">
      <div class="two-col">
        <div>
          <div class="section-title" style="color:#10b981">Strengths</div>
          ${result.strengths.map(s => `<div class="strength-item">${s}</div>`).join('')}
        </div>
        <div>
          <div class="section-title" style="color:#ef4444">Areas to Improve</div>
          ${result.weaknesses.map(w => `<div class="weakness-item">${w}</div>`).join('')}
        </div>
      </div>
    </div>

    ${result.advice ? `
    <div class="section">
      <div class="section-title" style="color:#3b82f6">Advice</div>
      <div class="advice-box">${result.advice}</div>
    </div>` : ''}

    <div class="footer">AI Interviewer — Confidential Report</div>
  </div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }</script>
</body>
</html>`

  printWindow.document.write(html)
  printWindow.document.close()
}

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
      // Auto-download PDF as soon as results load
      generatePDF(data)
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

        <div className="recommendation" style={{ backgroundColor: getRecommendationColor(result!.recommendation) }}>
          {result!.recommendation}
        </div>

        <div className="summary-box"><p>{result!.summary}</p></div>

        <div className="details-grid">
          <div className="detail-section">
            <h3>💪 Strengths</h3>
            <ul>{result!.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div className="detail-section">
            <h3>📈 Areas to Improve</h3>
            <ul>{result!.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        </div>

        {result!.topic_scores && Object.keys(result!.topic_scores).length > 0 && (
          <div className="topic-scores">
            <h3>📊 Score by Topic</h3>
            {Object.entries(result!.topic_scores).map(([topic, score]) => (
              <div key={topic} className="topic-row">
                <span className="topic-name">{topic}</span>
                <div className="topic-bar-bg">
                  <div className="topic-bar-fill" style={{
                    width: `${(score / 10) * 100}%`,
                    backgroundColor: score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444'
                  }} />
                </div>
                <span className="topic-score">{score}/10</span>
              </div>
            ))}
          </div>
        )}

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

        <div className="result-actions">
          <button className="btn-download" onClick={() => generatePDF(result!)}>
            ⬇️ Download Report
          </button>
          <button className="btn-primary" onClick={handleRestart}>
            Start New Interview
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResultScreen
