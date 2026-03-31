import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadResume } from '../api/api'
import '../styles/ResumeUpload.css'

type UploadMode = 'file' | 'text'

function ResumeUpload() {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [jdText, setJdText] = useState<string>('')
  const [jdMode, setJdMode] = useState<UploadMode>('file')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const navigate = useNavigate()

  const validateFile = (f: File, isJd = false): boolean => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const validTypesJd = [...validTypes, 'text/plain']
    const allowed = isJd ? validTypesJd : validTypes
    if (!allowed.includes(f.type) && !(isJd && f.name.endsWith('.txt'))) {
      setError(isJd ? 'JD must be PDF, DOCX, or TXT' : 'Resume must be PDF or DOCX')
      return false
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return false
    }
    setError('')
    return true
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f && validateFile(f)) setResumeFile(f)
  }

  const handleUpload = async () => {
    if (!resumeFile) { setError('Please select your resume'); return }
    setLoading(true); setError('')
    try {
      const response = await uploadResume(
        resumeFile,
        jdMode === 'file' ? jdFile : null,
        jdMode === 'text' ? jdText : undefined
      )
      localStorage.setItem('sessionId', response.session_id)
      navigate('/start')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="icon-large">📄</div>
        <h1>Upload Documents</h1>
        <p className="subtitle">Upload your resume and optionally the job description for tailored questions</p>

        {/* Resume upload */}
        <div className="section-label">Resume <span className="required">*</span></div>
        <div
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag} onDragLeave={handleDrag}
          onDragOver={handleDrag} onDrop={handleDrop}
        >
          <input type="file" id="resume-input" accept=".pdf,.docx"
            onChange={e => { const f = e.target.files?.[0]; if (f && validateFile(f)) setResumeFile(f) }}
            style={{ display: 'none' }} />
          {!resumeFile ? (
            <>
              <div className="upload-icon">📁</div>
              <p>Drag and drop your resume here</p>
              <label htmlFor="resume-input" className="btn-secondary">Browse Files</label>
              <p className="file-types">PDF, DOCX (Max 10MB)</p>
            </>
          ) : (
            <div className="file-selected">
              <div className="file-icon">✓</div>
              <p className="file-name">{resumeFile.name}</p>
              <p className="file-size">{(resumeFile.size / 1024).toFixed(1)} KB</p>
              <button className="btn-remove" onClick={() => setResumeFile(null)}>Remove</button>
            </div>
          )}
        </div>

        {/* JD upload */}
        <div className="section-label" style={{ marginTop: '20px' }}>
          Job Description <span className="optional">(optional — improves question relevance)</span>
        </div>
        <div className="jd-mode-toggle">
          <button
            className={`toggle-btn ${jdMode === 'file' ? 'active' : ''}`}
            onClick={() => setJdMode('file')}
          >📎 Upload File</button>
          <button
            className={`toggle-btn ${jdMode === 'text' ? 'active' : ''}`}
            onClick={() => setJdMode('text')}
          >✏️ Paste Text</button>
        </div>

        {jdMode === 'file' ? (
          <div className="upload-area jd-upload">
            <input type="file" id="jd-input" accept=".pdf,.docx,.txt"
              onChange={e => { const f = e.target.files?.[0]; if (f && validateFile(f, true)) setJdFile(f) }}
              style={{ display: 'none' }} />
            {!jdFile ? (
              <>
                <div className="upload-icon" style={{ fontSize: '1.5rem' }}>📋</div>
                <p>Upload job description</p>
                <label htmlFor="jd-input" className="btn-secondary">Browse Files</label>
                <p className="file-types">PDF, DOCX, TXT</p>
              </>
            ) : (
              <div className="file-selected">
                <div className="file-icon">✓</div>
                <p className="file-name">{jdFile.name}</p>
                <button className="btn-remove" onClick={() => setJdFile(null)}>Remove</button>
              </div>
            )}
          </div>
        ) : (
          <textarea
            className="jd-textarea"
            placeholder="Paste the job description here..."
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            rows={6}
          />
        )}

        {error && <div className="error">{error}</div>}

        <button className="btn-primary" onClick={handleUpload} disabled={!resumeFile || loading}>
          {loading ? 'Uploading & Analysing...' : 'Upload & Continue'}
        </button>

        <div className="info-text">
          <p>🔒 Your documents are securely stored and only used for this interview</p>
        </div>
      </div>
    </div>
  )
}

export default ResumeUpload
