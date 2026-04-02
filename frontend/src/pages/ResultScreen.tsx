import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFinalResult } from '../api/api'
import type { FinalReport } from '../types'
import '../styles/ResultScreen.css'

function generatePDF(result: FinalReport) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  const scoreColor = result.overall_score >= 65 ? '#34d399' : result.overall_score >= 50 ? '#fbbf24' : '#f87171'
  const recColor = result.recommendation.toLowerCase().includes('no hire') ? '#f87171'
    : result.recommendation.toLowerCase().includes('hire') ? '#34d399' : '#fbbf24'

  const qaRows = (result.qa_history || []).map((qa, i) => `
    <div class="qa-block">
      <div class="qa-header">
        <span>Q${i+1} · ${qa.topic} · ${qa.score}/10</span>
        <span class="qa-badge" style="background:${qa.score>=7?'#34d399':qa.score>=5?'#fbbf24':'#f87171'}">${qa.score}/10</span>
      </div>
      <p class="qa-q"><strong>Q:</strong> ${qa.question}</p>
      <p class="qa-a"><strong>A:</strong> ${qa.answer || '<em>No answer provided</em>'}</p>
      ${qa.feedback ? `<p class="qa-fb">${qa.feedback}</p>` : ''}
    </div>`).join('')

  const topicRows = result.topic_scores
    ? Object.entries(result.topic_scores).map(([t, s]) =>
        `<tr><td>${t}</td><td><div class="bar-bg"><div class="bar-fill" style="width:${s*10}%;background:${s>=7?'#34d399':s>=5?'#fbbf24':'#f87171'}"></div></div></td><td>${s}/10</td></tr>`).join('')
    : ''

  printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Interview Report</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff}
.hdr{background:#0d1526;color:#e2e8f0;padding:20px 30px}.hdr h1{font-size:20px;margin-bottom:4px}.hdr p{font-size:11px;opacity:.7}
.body{padding:24px 30px}.score-row{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.sc{width:64px;height:64px;border-radius:50%;background:${scoreColor};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}
.sc .n{font-size:20px;font-weight:700;line-height:1}.sc .l{font-size:9px}
.rec{padding:5px 14px;border-radius:16px;background:${recColor};color:#fff;font-weight:700;font-size:12px}
.section{margin-bottom:18px}.section-title{font-size:13px;font-weight:700;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px}
.summary-box{background:#f8fafc;border-left:3px solid #38bdf8;padding:8px 12px;border-radius:4px;color:#475569;line-height:1.6}
.qa-block{border:1px solid #e2e8f0;border-radius:6px;margin-bottom:10px;overflow:hidden}
.qa-header{background:#f1f5f9;padding:6px 10px;display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#38bdf8}
.qa-badge{color:#fff;padding:2px 7px;border-radius:8px;font-size:10px}
.qa-q,.qa-a{padding:5px 10px;line-height:1.5}.qa-fb{padding:4px 10px 8px;color:#64748b;font-size:11px;font-style:italic}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.si::before{content:"✓ ";color:#34d399;font-weight:700}.wi::before{content:"→ ";color:#f87171;font-weight:700}
table{width:100%;border-collapse:collapse}td{padding:4px 6px;vertical-align:middle}
.bar-bg{background:#e2e8f0;border-radius:4px;height:7px}.bar-fill{height:7px;border-radius:4px}
.footer{text-align:center;color:#94a3b8;font-size:10px;margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="hdr"><h1>AI Interview Report</h1><p>Generated: ${new Date().toLocaleString()}</p></div>
<div class="body">
<div class="score-row"><div class="sc"><span class="n">${Math.round(result.overall_score)}</span><span class="l">/100</span></div>
<div><div class="rec">${result.recommendation}</div><p style="margin-top:6px;color:#64748b;font-size:11px">${result.total_questions} questions</p></div></div>
<div class="section"><div class="section-title">Summary</div><div class="summary-box">${result.summary}</div></div>
<div class="section"><div class="section-title">Q&A Detail</div>${qaRows}</div>
${topicRows ? `<div class="section"><div class="section-title">Score by Topic</div><table>${topicRows}</table></div>` : ''}
<div class="section"><div class="two-col">
<div><div class="section-title" style="color:#34d399">Strengths</div>${result.strengths.map(s=>`<p class="si">${s}</p>`).join('')}</div>
<div><div class="section-title" style="color:#f87171">Improve</div>${result.weaknesses.map(w=>`<p class="wi">${w}</p>`).join('')}</div>
</div></div>
${result.advice ? `<div class="section"><div class="section-title" style="color:#818cf8">Advice</div><div class="summary-box" style="border-color:#818cf8">${result.advice}</div></div>` : ''}
<div class="footer">AI Interviewer — Confidential</div></div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
</body></html>`)
  printWindow.document.close()
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
      .then(data => { setResult(data); generatePDF(data) })
      .catch(err => setError(err.response?.data?.detail || 'Failed to load results'))
      .finally(() => setLoading(false))
  }, [])

  const recColor = (rec: string) => {
    const r = rec.toLowerCase()
    if (r.includes('strong hire')) return 'var(--success)'
    if (r.includes('no hire')) return 'var(--danger)'
    if (r.includes('hire')) return 'var(--success)'
    return 'var(--warning)'
  }

  if (loading) return (
    <div className="rs-page">
      <div className="rs-loading">
        <div className="rs-spinner" />
        <p>Evaluating your answers…</p>
        <span>Generating personalised report</span>
      </div>
    </div>
  )

  if (error) return (
    <div className="rs-page"><div className="rs-error-card"><p>{error}</p><button onClick={() => { localStorage.removeItem('sessionId'); navigate('/') }}>Start Over</button></div></div>
  )

  const r = result!
  return (
    <div className="rs-page">
      <div className="rs-container">

        {/* Score hero */}
        <div className="rs-hero">
          <div className="rs-score-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-elevated)" strokeWidth="8"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#grad)" strokeWidth="8"
                strokeDasharray={`${(r.overall_score / 100) * 314} 314`}
                strokeLinecap="round" transform="rotate(-90 60 60)"/>
              <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--accent)"/>
                <stop offset="100%" stopColor="var(--purple)"/>
              </linearGradient></defs>
            </svg>
            <div className="rs-score-inner">
              <span className="rs-score-num">{Math.round(r.overall_score)}</span>
              <span className="rs-score-sub">/ 100</span>
            </div>
          </div>
          <div className="rs-hero-info">
            <div className="rs-rec" style={{ color: recColor(r.recommendation), borderColor: recColor(r.recommendation) }}>
              {r.recommendation}
            </div>
            <p className="rs-questions-count">{r.total_questions} questions answered</p>
            <p className="rs-summary">{r.summary}</p>
          </div>
        </div>

        {/* Grid: strengths + weaknesses */}
        <div className="rs-grid">
          <div className="rs-card">
            <h3 className="rs-card-title success">Strengths</h3>
            <ul className="rs-list">
              {r.strengths.map((s, i) => <li key={i}><span className="dot success" />{s}</li>)}
            </ul>
          </div>
          <div className="rs-card">
            <h3 className="rs-card-title danger">Areas to Improve</h3>
            <ul className="rs-list">
              {r.weaknesses.map((w, i) => <li key={i}><span className="dot danger" />{w}</li>)}
            </ul>
          </div>
        </div>

        {/* Topic scores */}
        {r.topic_scores && Object.keys(r.topic_scores).length > 0 && (
          <div className="rs-card rs-topics">
            <h3 className="rs-card-title">Score by Topic</h3>
            <div className="rs-topic-list">
              {Object.entries(r.topic_scores).map(([topic, score]) => (
                <div key={topic} className="rs-topic-row">
                  <span className="rs-topic-name">{topic}</span>
                  <div className="rs-bar-track">
                    <div className="rs-bar-fill" style={{
                      width: `${(score / 10) * 100}%`,
                      background: score >= 7 ? 'var(--success)' : score >= 5 ? 'var(--warning)' : 'var(--danger)'
                    }} />
                  </div>
                  <span className="rs-topic-score">{score}/10</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advice */}
        {r.advice && (
          <div className="rs-card rs-advice">
            <h3 className="rs-card-title purple">Advice</h3>
            <p>{r.advice}</p>
          </div>
        )}

        {/* Q&A history */}
        {r.qa_history && r.qa_history.length > 0 && (
          <div className="rs-card">
            <h3 className="rs-card-title">Q&A Detail</h3>
            <div className="rs-qa-list">
              {r.qa_history.map((qa, i) => (
                <div key={i} className="rs-qa-item">
                  <div className="rs-qa-header">
                    <span className="rs-qa-num">Q{i + 1}</span>
                    <span className="rs-qa-topic">{qa.topic}</span>
                    <span className="rs-qa-score" style={{ color: qa.score >= 7 ? 'var(--success)' : qa.score >= 5 ? 'var(--warning)' : 'var(--danger)' }}>{qa.score}/10</span>
                  </div>
                  <p className="rs-qa-q">{qa.question}</p>
                  <p className="rs-qa-a">{qa.answer || <em>No answer provided</em>}</p>
                  {qa.feedback && <p className="rs-qa-fb">{qa.feedback}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="rs-actions">
          <button className="btn-download" onClick={() => generatePDF(r)}>Download Report</button>
          <button className="btn-restart" onClick={() => { localStorage.removeItem('sessionId'); navigate('/') }}>New Interview</button>
        </div>

      </div>
    </div>
  )
}

export default ResultScreen
