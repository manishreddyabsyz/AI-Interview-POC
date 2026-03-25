import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ResumeUpload from './pages/ResumeUpload'
import StartInterview from './pages/StartInterview'
import InterviewScreen from './pages/InterviewScreen'
import ResultScreen from './pages/ResultScreen'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ResumeUpload />} />
        <Route path="/start" element={<StartInterview />} />
        <Route path="/interview" element={<InterviewScreen />} />
        <Route path="/result" element={<ResultScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
