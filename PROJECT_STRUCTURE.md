# Project Structure

```
ai-interviewer/
│
├── backend/                          # FastAPI Backend
│   ├── main.py                       # Main FastAPI application & routes
│   ├── config.py                     # Configuration & environment variables
│   ├── models.py                     # Pydantic data models
│   ├── session_manager.py            # Interview session management
│   ├── requirements.txt              # Python dependencies
│   ├── setup.py                      # Setup script
│   ├── .env.example                  # Environment variables template
│   │
│   ├── services/
│   │   └── ollama_service.py         # Ollama AI integration
│   │
│   └── utils/
│       ├── resume_parser.py          # PDF/DOCX parsing
│       └── cloudinary_helper.py      # Cloudinary upload
│
├── frontend/                         # React Frontend
│   ├── index.html                    # HTML entry point
│   ├── package.json                  # Node dependencies
│   ├── vite.config.js                # Vite configuration
│   │
│   └── src/
│       ├── main.jsx                  # React entry point
│       ├── App.jsx                   # Main app component
│       ├── index.css                 # Global styles
│       │
│       ├── pages/                    # Page components
│       │   ├── ResumeUpload.jsx      # Resume upload page
│       │   ├── StartInterview.jsx    # Interview start page
│       │   ├── InterviewScreen.jsx   # Main interview page
│       │   └── ResultScreen.jsx      # Results page
│       │
│       ├── styles/                   # CSS modules
│       │   ├── ResumeUpload.css
│       │   ├── StartInterview.css
│       │   ├── InterviewScreen.css
│       │   └── ResultScreen.css
│       │
│       └── api/
│           └── api.js                # API client functions
│
├── README.md                         # Project overview
├── SETUP_GUIDE.md                    # Detailed setup instructions
├── API_DOCUMENTATION.md              # API endpoint documentation
├── DEPLOYMENT.md                     # Production deployment guide
├── TESTING.md                        # Testing guide
├── PROJECT_STRUCTURE.md              # This file
├── .gitignore                        # Git ignore rules
├── start-backend.bat                 # Windows backend launcher
└── start-frontend.bat                # Windows frontend launcher
```

## File Descriptions

### Backend Files

**main.py**
- FastAPI application initialization
- API route definitions
- CORS middleware configuration
- All endpoint implementations

**config.py**
- Environment variable loading
- Configuration settings
- Cloudinary and Ollama URLs

**models.py**
- Pydantic models for request/response validation
- Type definitions for API contracts

**session_manager.py**
- Interview session state management
- Question history tracking
- Score calculation
- Difficulty adaptation logic

**services/ollama_service.py**
- Ollama API integration
- Skill extraction from resume
- Question generation
- Answer evaluation
- Final report generation

**utils/resume_parser.py**
- PDF text extraction (PyPDF2)
- DOCX text extraction (python-docx)
- File format validation

**utils/cloudinary_helper.py**
- Cloudinary SDK configuration
- Resume file upload
- URL generation

### Frontend Files

**src/main.jsx**
- React application entry point
- Root component rendering

**src/App.jsx**
- React Router setup
- Route definitions
- Main app structure

**src/pages/ResumeUpload.jsx**
- File upload UI
- File validation
- API integration for upload

**src/pages/StartInterview.jsx**
- Interview instructions
- Session initialization
- Navigation to interview

**src/pages/InterviewScreen.jsx**
- Question display
- Timer implementation
- Voice recording (Web Speech API)
- Answer submission
- Feedback display
- Progress tracking

**src/pages/ResultScreen.jsx**
- Final score display
- Strengths/weaknesses
- Recommendation
- Statistics

**src/api/api.js**
- Axios HTTP client
- API endpoint functions
- Request/response handling

### Configuration Files

**backend/requirements.txt**
- Python package dependencies
- Version specifications

**frontend/package.json**
- Node.js dependencies
- Build scripts
- Project metadata

**vite.config.js**
- Vite build configuration
- Development server settings

**.env.example**
- Environment variable template
- Configuration documentation

**.gitignore**
- Files to exclude from Git
- Build artifacts, secrets, etc.

## Data Flow

### 1. Resume Upload Flow
```
User → ResumeUpload.jsx → api.js → /upload-resume
→ resume_parser.py → cloudinary_helper.py
→ ollama_service.py (extract skills)
→ session_manager.py (create session)
→ Response with session_id
```

### 2. Interview Flow
```
User → StartInterview.jsx → /start-interview
→ InterviewScreen.jsx → /next-question
→ ollama_service.py (generate question)
→ Display question + timer
→ User answers → /submit-answer
→ ollama_service.py (evaluate)
→ Display feedback
→ Repeat 12 times
```

### 3. Result Flow
```
Interview complete → ResultScreen.jsx → /final-result
→ ollama_service.py (generate report)
→ Display comprehensive evaluation
```

## Key Technologies

### Backend
- **FastAPI**: Modern Python web framework
- **Uvicorn**: ASGI server
- **PyPDF2**: PDF parsing
- **python-docx**: DOCX parsing
- **Cloudinary**: Cloud storage
- **httpx**: Async HTTP client
- **Pydantic**: Data validation

### Frontend
- **React 18**: UI library
- **React Router**: Navigation
- **Vite**: Build tool
- **Axios**: HTTP client
- **Web Speech API**: Voice recognition

### AI
- **Ollama**: Local LLM runtime
- **qwen2.5:7b-instruct**: Language model

## Environment Variables

### Backend (.env)
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

### Frontend (.env.production)
```
VITE_API_URL=https://api.yourdomain.com
```

## Port Configuration

- **Backend**: 8000 (FastAPI)
- **Frontend**: 3000 (Vite dev server)
- **Ollama**: 11434 (LLM service)

## Build Outputs

### Backend
- No build step required
- Runs directly with Python

### Frontend
- Development: `npm run dev`
- Production: `npm run build` → `dist/` folder
- Preview: `npm run preview`

## Session Storage

Currently in-memory (development):
- Sessions stored in `SessionManager` class
- Lost on server restart

For production:
- Use Redis or database
- Implement session persistence
- Add session expiration

## API Flow Diagram

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├─── POST /upload-resume
       │    └─→ Returns session_id
       │
       ├─── POST /start-interview
       │    └─→ Initializes session
       │
       ├─── GET /next-question (x12)
       │    └─→ Returns AI question
       │
       ├─── POST /submit-answer (x12)
       │    └─→ Returns score & feedback
       │
       └─── GET /final-result
            └─→ Returns evaluation report
```

## State Management

### Backend State
- Session data in `SessionManager`
- Interview progress tracking
- Q&A history
- Score accumulation

### Frontend State
- React useState hooks
- localStorage for session_id
- Component-level state
- No global state management (simple app)

## Error Handling

### Backend
- Try-catch blocks
- HTTPException for API errors
- Detailed error messages
- Status code mapping

### Frontend
- Try-catch in async functions
- Error state in components
- User-friendly error messages
- Fallback UI

## Future Enhancements

Potential additions:
- Database integration (PostgreSQL)
- User authentication (JWT)
- Interview history
- Multiple interview types
- Video recording
- Real-time collaboration
- Analytics dashboard
- Email reports
- Resume templates
- Multi-language support
