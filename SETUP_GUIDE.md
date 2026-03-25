# AI Interviewer - Complete Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/

2. **Python** (v3.9 or higher)
   - Download: https://www.python.org/downloads/

3. **Ollama** (Local LLM)
   - Download: https://ollama.ai/download
   - After installation, run:
     ```bash
     ollama serve
     ollama pull qwen2.5:7b-instruct
     ```

4. **Cloudinary Account** (Free tier works)
   - Sign up: https://cloudinary.com/users/register/free
   - Get your credentials from Dashboard

## Step-by-Step Setup

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create .env file
copy .env.example .env

# Edit .env with your credentials
# CLOUDINARY_CLOUD_NAME=your_cloud_name
# CLOUDINARY_API_KEY=your_api_key
# CLOUDINARY_API_SECRET=your_api_secret
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=qwen2.5:7b-instruct
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install
```

### 3. Start Ollama (Required)

Open a terminal and run:
```bash
ollama serve
```

Keep this terminal running. Ollama must be active for the AI to work.

### 4. Start Backend Server

Open a new terminal:
```bash
cd backend
python main.py
```

Backend will run on: http://localhost:8000

### 5. Start Frontend

Open another terminal:
```bash
cd frontend
npm run dev
```

Frontend will run on: http://localhost:3000

## Testing the Application

1. Open browser: http://localhost:3000
2. Upload a resume (PDF or DOCX)
3. Click "Start AI Interview"
4. Answer questions using voice or text
5. View your final evaluation

## Troubleshooting

### Ollama Connection Error
- Make sure Ollama is running: `ollama serve`
- Check if model is downloaded: `ollama list`
- If not, download: `ollama pull qwen2.5:7b-instruct`

### Cloudinary Upload Error
- Verify credentials in `.env` file
- Check Cloudinary dashboard for API limits
- Ensure file size is under 10MB

### CORS Error
- Backend must be running on port 8000
- Frontend must be running on port 3000
- Check firewall settings

### Speech Recognition Not Working
- Use Chrome or Edge browser (best support)
- Allow microphone permissions
- Fallback: Type answers manually

## Project Structure

```
ai-interviewer/
├── backend/
│   ├── main.py                 # FastAPI app
│   ├── config.py               # Configuration
│   ├── models.py               # Pydantic models
│   ├── session_manager.py      # Session handling
│   ├── services/
│   │   └── ollama_service.py   # AI logic
│   └── utils/
│       ├── resume_parser.py    # PDF/DOCX parsing
│       └── cloudinary_helper.py # Cloud storage
├── frontend/
│   ├── src/
│   │   ├── pages/              # React pages
│   │   ├── styles/             # CSS files
│   │   └── api/                # API client
│   └── package.json
└── README.md
```

## API Endpoints

- `POST /upload-resume` - Upload and parse resume
- `POST /start-interview` - Initialize interview
- `GET /next-question` - Get next question
- `POST /submit-answer` - Submit and evaluate answer
- `GET /final-result` - Get final report

## Features

✅ Resume upload (PDF/DOCX) with Cloudinary storage
✅ AI-powered question generation from resume
✅ Voice recording with Web Speech API
✅ 15-second timer per question
✅ Real-time answer evaluation
✅ Adaptive difficulty based on performance
✅ Comprehensive final report with recommendations

## Notes

- Interview consists of 12 questions
- Each question has 15-second time limit
- Questions adapt based on your answers
- Final score is out of 100
- Recommendation: Hire / No Hire / Maybe

## Support

For issues or questions:
1. Check Ollama is running
2. Verify .env configuration
3. Check browser console for errors
4. Ensure all dependencies are installed
