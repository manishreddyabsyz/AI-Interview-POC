import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadResume } from '../api/api'
import '../styles/ResumeUpload.css'

function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [dragActive, setDragActive] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      validateAndSetFile(selectedFile)
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    
    if (!validTypes.includes(selectedFile.type)) {
      setError('Please upload a PDF or DOCX file')
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setFile(selectedFile)
    setError('')
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await uploadResume(file)
      localStorage.setItem('sessionId', response.session_id)
      navigate('/start')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to upload resume')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="icon-large">📄</div>
        <h1>Upload Your Resume</h1>
        <p className="subtitle">
          Upload your resume to start the AI-powered interview
        </p>

        <div
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-input"
            accept=".pdf,.docx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          {!file ? (
            <>
              <div className="upload-icon">📁</div>
              <p>Drag and drop your resume here</p>
              <p className="upload-hint">or</p>
              <label htmlFor="file-input" className="btn-secondary">
                Browse Files
              </label>
              <p className="file-types">Supported: PDF, DOCX (Max 10MB)</p>
            </>
          ) : (
            <div className="file-selected">
              <div className="file-icon">✓</div>
              <p className="file-name">{file.name}</p>
              <p className="file-size">{(file.size / 1024).toFixed(2)} KB</p>
              <button
                className="btn-remove"
                onClick={() => setFile(null)}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <button
          className="btn-primary"
          onClick={handleUpload}
          disabled={!file || loading}
        >
          {loading ? 'Uploading...' : 'Upload & Continue'}
        </button>

        <div className="info-text">
          <p>🔒 Your resume is securely stored and will only be used for this interview</p>
        </div>
      </div>
    </div>
  )
}

export default ResumeUpload
