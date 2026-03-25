# System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER BROWSER                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Frontend (Port 3000)                 │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │  Upload  │  │Interview │  │ Results  │            │ │
│  │  │   Page   │→ │  Screen  │→ │  Screen  │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  │         ↓              ↓              ↓                │ │
│  │  ┌─────────────────────────────────────────┐          │ │
│  │  │      API Client (Axios)                 │          │ │
│  │  └─────────────────────────────────────────┘          │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/REST
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              FastAPI Backend (Port 8000)                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   API Routes                            │ │
│  │  /upload-resume  /start-interview  /next-question      │ │
│  │  /submit-answer  /final-result                         │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Session Manager                            │ │
│  │  - Track interview state                               │ │
│  │  - Store Q&A history                                   │ │
│  │  - Calculate scores                                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↓                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                   Services Layer                        │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │   Ollama     │  │  Cloudinary  │                   │ │
│  │  │   Service    │  │   Service    │                   │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ↓                             ↓
┌───────────────────────────┐   ┌───────────────────────────┐
│  Ollama (Port 11434)      │   │  Cloudinary Cloud         │
│  ┌─────────────────────┐  │   │  ┌─────────────────────┐ │
│  │ qwen2.5:7b-instruct │  │   │  │  Resume Storage     │ │
│  │  - Generate Q's     │  │   │  │  - PDF/DOCX files   │ │
│  │  - Evaluate A's     │  │   │  │  - CDN delivery     │ │
│  │  - Extract skills   │  │   │  └─────────────────────┘ │
│  └─────────────────────┘  │   └───────────────────────────┘
└───────────────────────────┘
```

## 🔄 Data Flow Diagrams

### 1. Resume Upload Flow

```
User
  │
  │ 1. Select PDF/DOCX file
  ↓
ResumeUpload.jsx
  │
  │ 2. POST /upload-resume
  ↓
FastAPI Backend
  │
  ├─→ 3. Parse file (PyPDF2/python-docx)
  │
  ├─→ 4. Upload to Cloudinary
  │
  ├─→ 5. Extract skills (Ollama)
  │
  └─→ 6. Create session
  │
  │ 7. Return session_id + resume_url
  ↓
Frontend
  │
  │ 8. Store session_id in localStorage
  │
  └─→ Navigate to Start Interview
```

### 2. Interview Flow

```
User clicks "Start Interview"
  │
  │ 1. POST /start-interview
  ↓
Backend initializes session
  │
  │ 2. Navigate to Interview Screen
  ↓
┌─────────────────────────────────────┐
│  Interview Loop (12 iterations)     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ 1. GET /next-question         │ │
│  │    ↓                          │ │
│  │ 2. Ollama generates question  │ │
│  │    ↓                          │ │
│  │ 3. Display question + timer   │ │
│  │    ↓                          │ │
│  │ 4. User answers (voice/text)  │ │
│  │    ↓                          │ │
│  │ 5. POST /submit-answer        │ │
│  │    ↓                          │ │
│  │ 6. Ollama evaluates answer    │ │
│  │    ↓                          │ │
│  │ 7. Display score + feedback   │ │
│  │    ↓                          │ │
│  │ 8. Adjust difficulty          │ │
│  └───────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
  │
  │ Interview complete
  ↓
GET /final-result
  │
  │ Ollama generates report
  ↓
Display Results Screen
```

### 3. Question Generation Flow

```
Backend receives /next-question request
  │
  ↓
Session Manager
  │
  ├─→ Get resume text
  ├─→ Get extracted skills
  ├─→ Get previous Q&A history
  └─→ Get current difficulty level
  │
  ↓
Ollama Service
  │
  │ Build prompt with context:
  │ - Resume skills
  │ - Already asked topics
  │ - Difficulty level
  │ - Question requirements
  │
  ↓
Ollama LLM (qwen2.5:7b-instruct)
  │
  │ Generate relevant question
  │
  ↓
Return question to frontend
```

### 4. Answer Evaluation Flow

```
User submits answer
  │
  ↓
POST /submit-answer
  │
  ├─→ Question text
  ├─→ User's answer
  └─→ Resume context
  │
  ↓
Ollama Service
  │
  │ Build evaluation prompt:
  │ - Question asked
  │ - Answer provided
  │ - Evaluation criteria
  │
  ↓
Ollama LLM
  │
  │ Evaluate answer
  │ - Score (0-10)
  │ - Feedback
  │ - Topic identified
  │
  ↓
Session Manager
  │
  ├─→ Store Q&A in history
  ├─→ Update total score
  └─→ Adjust difficulty
  │
  ↓
Return evaluation to frontend
```

## 🗂️ Component Architecture

### Backend Components

```
backend/
│
├── main.py (FastAPI App)
│   ├── CORS Middleware
│   ├── Route Handlers
│   └── Error Handling
│
├── session_manager.py
│   ├── InterviewSession class
│   │   ├── resume_text
│   │   ├── skills
│   │   ├── qa_history
│   │   ├── current_question_number
│   │   ├── total_score
│   │   └── difficulty
│   │
│   └── SessionManager class
│       ├── create_session()
│       ├── get_session()
│       └── delete_session()
│
├── services/
│   └── ollama_service.py
│       ├── generate_response()
│       ├── extract_skills()
│       ├── generate_question()
│       ├── evaluate_answer()
│       └── generate_final_report()
│
└── utils/
    ├── resume_parser.py
    │   ├── extract_text_from_pdf()
    │   ├── extract_text_from_docx()
    │   └── parse_resume()
    │
    └── cloudinary_helper.py
        └── upload_resume()
```

### Frontend Components

```
frontend/src/
│
├── App.jsx (Router)
│   └── Routes
│       ├── / → ResumeUpload
│       ├── /start → StartInterview
│       ├── /interview → InterviewScreen
│       └── /result → ResultScreen
│
├── pages/
│   ├── ResumeUpload.jsx
│   │   ├── File input
│   │   ├── Validation
│   │   └── Upload handler
│   │
│   ├── StartInterview.jsx
│   │   ├── Instructions
│   │   └── Start button
│   │
│   ├── InterviewScreen.jsx
│   │   ├── Question display
│   │   ├── Timer component
│   │   ├── Answer input
│   │   ├── Voice recording
│   │   ├── Submit handler
│   │   └── Feedback display
│   │
│   └── ResultScreen.jsx
│       ├── Score display
│       ├── Strengths list
│       ├── Weaknesses list
│       └── Recommendation
│
└── api/
    └── api.js
        ├── uploadResume()
        ├── startInterview()
        ├── getNextQuestion()
        ├── submitAnswer()
        └── getFinalResult()
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────┐
│         Security Layers             │
├─────────────────────────────────────┤
│                                     │
│  1. Input Validation                │
│     - File type checking            │
│     - File size limits              │
│     - Content validation            │
│                                     │
│  2. Environment Variables           │
│     - API keys in .env              │
│     - No secrets in code            │
│                                     │
│  3. CORS Protection                 │
│     - Allowed origins               │
│     - Credential handling           │
│                                     │
│  4. Error Handling                  │
│     - No sensitive data in errors   │
│     - Generic error messages        │
│                                     │
│  5. Cloud Storage                   │
│     - Cloudinary security           │
│     - Signed URLs                   │
│                                     │
└─────────────────────────────────────┘
```

## 📊 State Management

### Backend State (In-Memory)

```
SessionManager
  │
  └── sessions: Dict[session_id, InterviewSession]
        │
        └── InterviewSession
              ├── session_id: str
              ├── resume_text: str
              ├── resume_url: str
              ├── skills: List[str]
              ├── qa_history: List[Dict]
              ├── current_question_number: int
              ├── total_questions: int
              ├── total_score: int
              ├── difficulty: str
              └── created_at: datetime
```

### Frontend State (React useState)

```
ResumeUpload
  ├── file: File | null
  ├── loading: boolean
  └── error: string

StartInterview
  ├── loading: boolean
  └── error: string

InterviewScreen
  ├── question: string
  ├── questionNumber: int
  ├── totalQuestions: int
  ├── answer: string
  ├── timeLeft: int
  ├── loading: boolean
  ├── isRecording: boolean
  ├── feedback: object | null
  └── error: string

ResultScreen
  ├── result: object | null
  ├── loading: boolean
  └── error: string

Global (localStorage)
  └── sessionId: string
```

## 🔄 API Request/Response Flow

```
Frontend                Backend                 Ollama
   │                       │                       │
   │  POST /upload-resume  │                       │
   ├──────────────────────→│                       │
   │                       │  Extract skills       │
   │                       ├──────────────────────→│
   │                       │←──────────────────────┤
   │                       │  [skills array]       │
   │←──────────────────────┤                       │
   │  {session_id, url}    │                       │
   │                       │                       │
   │  GET /next-question   │                       │
   ├──────────────────────→│                       │
   │                       │  Generate question    │
   │                       ├──────────────────────→│
   │                       │←──────────────────────┤
   │                       │  [question text]      │
   │←──────────────────────┤                       │
   │  {question, number}   │                       │
   │                       │                       │
   │  POST /submit-answer  │                       │
   ├──────────────────────→│                       │
   │                       │  Evaluate answer      │
   │                       ├──────────────────────→│
   │                       │←──────────────────────┤
   │                       │  [score, feedback]    │
   │←──────────────────────┤                       │
   │  {score, feedback}    │                       │
```

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Production                         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────┐         ┌──────────────────┐   │
│  │   CDN/S3       │         │   Load Balancer  │   │
│  │  (Frontend)    │         │                  │   │
│  └────────────────┘         └────────┬─────────┘   │
│                                      │              │
│                          ┌───────────┴───────────┐  │
│                          │                       │  │
│                    ┌─────▼─────┐         ┌──────▼──┐
│                    │  Backend  │         │ Backend │
│                    │  Instance │         │Instance │
│                    └─────┬─────┘         └────┬────┘
│                          │                    │     │
│                          └──────────┬─────────┘     │
│                                     │               │
│                          ┌──────────▼──────────┐    │
│                          │   Ollama Server     │    │
│                          │   (GPU Instance)    │    │
│                          └─────────────────────┘    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 📈 Scalability Considerations

### Horizontal Scaling

```
                    Load Balancer
                         │
        ┌────────────────┼────────────────┐
        │                │                │
   Backend 1        Backend 2        Backend 3
        │                │                │
        └────────────────┼────────────────┘
                         │
                    Shared State
                  (Redis/Database)
```

### Vertical Scaling

```
Current:
- Backend: 500 MB RAM
- Ollama: 6 GB RAM

Scaled:
- Backend: 2 GB RAM (more concurrent users)
- Ollama: 16 GB RAM (larger model, faster inference)
```

---

**This architecture is designed for:**
- ✅ Modularity
- ✅ Scalability
- ✅ Maintainability
- ✅ Security
- ✅ Performance
