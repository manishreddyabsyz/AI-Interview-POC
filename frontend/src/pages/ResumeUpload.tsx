import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadResume } from '../api/api'
import '../styles/ResumeUpload.css'

function ResumeUpload() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState('')
  const [jdMode, setJdMode] = useState<'text' | 'file'>('text')
  const [resumeDrag, setResumeDrag] = useState(false)
  const [jdDrag, setJdDrag] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const jdInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const validateFile = (f: File) => {
    const valid = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!valid.includes(f.type)) return 'Only PDF or DOCX files are supported'
    if (f.size > 10 * 1024 * 1024) return 'File must be under 10MB'
    return null
  }

  const handleResumeDrop = (e: React.DragEvent) => {
    e.preventDefault(); setResumeDrag(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) { setError(err); return }
    setResumeFile(f); setError('')
  }

  const handleJdDrop = (e: React.DragEvent) => {
    e.preventDefault(); setJdDrag(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    const err = validateFile(f)
    if (err) { setError(err); return }
    setJdFile(f); setError('')
  }

  const handleUpload = async () => {
    if (!resumeFile) { setError('Please upload your resume'); return }
    const hasJd = jdMode === 'text' ? jdText.trim().length > 20 : !!jdFile
    if (!hasJd) { setError('Please provide the Job Description'); return }

    setLoading(true); setError('')
    try {
      const response = await uploadResume(
        resumeFile,
        jdMode === 'text' ? jdText : '',
        jdMode === 'file' ? jdFile : null
      )
      localStorage.setItem('sessionId', response.session_id)
      navigate('/start')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = resumeFile && (jdMode === 'text' ? jdText.trim().length > 20 : !!jdFile)

  return (
    <div className="upload-page">
      <div className="upload-header">
        <div className="logo-mark">AI</div>
        <h1>Interview Assessment</h1>
        <p>Upload your resume and job description to begin your AI-powered technical interview</p>
      </div>

      <div className="upload-panels">

        {/* Resume Panel */}
        <div className="upload-panel">
          <div className="panel-label">
            <span className="panel-number">01</span>
            <span>Resume</span>
          </div>
          <div
            className={`drop-zone ${resumeDrag ? 'drag-over' : ''} ${resumeFile ? 'has-file' : ''}`}
            onDragEnter={e => { e.preventDefault(); setResumeDrag(true) }}
            onDragOver={e => { e.preventDefault(); setResumeDrag(true) }}
            onDragLeave={() => setResumeDrag(false)}
            onDrop={handleResumeDrop}
            onClick={() => !resumeFile && resumeInputRef.current?.click()}
          >
            <input ref={resumeInputRef} type="file" accept=".pdf,.docx" hidden
              onChange={e => { const f = e.target.files?.[0]; if (f) { const err = validateFile(f); if (err) setError(err); else { setResumeFile(f); setError('') } } }} />
            {resumeFile ? (
              <div className="file-info">
                <div className="file-icon-check">✓</div>
                <span className="file-name">{resumeFile.name}</span>
                <span className="file-size">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                <button className="btn-remove" onClick={e => { e.stopPropagation(); setResumeFile(null) }}>Remove</button>
              </div>
            ) : (
              <div className="drop-inner">
                <div className="drop-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14,2 14,8 20,8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                </div>
                <p>Drag & drop or <span className="link">browse</span></p>
                <p className="hint">PDF or DOCX · Max 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* JD Panel */}
        <div className="upload-panel">
          <div className="panel-label">
            <span className="panel-number">02</span>
            <span>Job Description</span>
            <div className="mode-toggle">
              <button className={jdMode === 'text' ? 'active' : ''} onClick={() => setJdMode('text')}>Paste</button>
              <button className={jdMode === 'file' ? 'active' : ''} onClick={() => setJdMode('file')}>File</button>
            </div>
          </div>

          {jdMode === 'text' ? (
            <textarea
              className="jd-textarea"
              placeholder="Paste the job description here…&#10;&#10;Include responsibilities, required skills, and qualifications for best results."
              value={jdText}
              onChange={e => setJdText(e.target.value)}
            />
          ) : (
            <div
              className={`drop-zone ${jdDrag ? 'drag-over' : ''} ${jdFile ? 'has-file' : ''}`}
              onDragEnter={e => { e.preventDefault(); setJdDrag(true) }}
              onDragOver={e => { e.preventDefault(); setJdDrag(true) }}
              onDragLeave={() => setJdDrag(false)}
              onDrop={handleJdDrop}
              onClick={() => !jdFile && jdInputRef.current?.click()}
            >
              <input ref={jdInputRef} type="file" accept=".pdf,.docx" hidden
                onChange={e => { const f = e.target.files?.[0]; if (f) { const err = validateFile(f); if (err) setError(err); else { setJdFile(f); setError('') } } }} />
              {jdFile ? (
                <div className="file-info">
                  <div className="file-icon-check">✓</div>
                  <span className="file-name">{jdFile.name}</span>
                  <span className="file-size">{(jdFile.size / 1024).toFixed(0)} KB</span>
                  <button className="btn-remove" onClick={e => { e.stopPropagation(); setJdFile(null) }}>Remove</button>
                </div>
              ) : (
                <div className="drop-inner">
                  <div className="drop-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                    </svg>
                  </div>
                  <p>Drag & drop or <span className="link">browse</span></p>
                  <p className="hint">PDF or DOCX · Max 10MB</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <div className="upload-error">{error}</div>}

      <button className="btn-start" onClick={handleUpload} disabled={!canSubmit || loading}>
        {loading ? (
          <><span className="spinner" /> Analysing documents…</>
        ) : (
          <><span>Begin Interview</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg></>
        )}
      </button>

      <p className="upload-footer">Your documents are processed locally and never stored beyond this session</p>
    </div>
  )
}

export default ResumeUpload
