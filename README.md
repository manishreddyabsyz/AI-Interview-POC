# 🎯 AI Interviewer Application

A complete full-stack AI-powered interview application that conducts intelligent technical interviews based on uploaded resumes. Built with modern technologies and local AI for privacy and control.

## ✨ Features

- 📄 **Resume Upload**: Support for PDF and DOCX formats with cloud storage
- 🤖 **AI-Powered Questions**: Dynamic question generation based on resume content
- 🎤 **Voice Recognition**: Answer questions using speech-to-text or typing
- ⏱️ **Timed Questions**: 15-second timer per question for realistic interview pressure
- 📊 **Adaptive Difficulty**: Questions adjust based on your performance
- 📈 **Comprehensive Evaluation**: Detailed report with scores, strengths, and recommendations
- 🔒 **Privacy-First**: Uses local Ollama LLM - your data stays on your machine

## 🛠️ Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing
- **Web Speech API** - Voice recognition
- **Axios** - HTTP client

### Backend
- **FastAPI** - High-performance Python web framework
- **Uvicorn** - ASGI server
- **PyPDF2** - PDF parsing
- **python-docx** - DOCX parsing
- **Cloudinary** - Cloud storage for resumes

### AI
- **Ollama** - Local LLM runtime
- **qwen2.5:7b-instruct** - Instruction-tuned language model

## 🚀 Quick Start

### Prerequisites

1. **Python 3.9+** - [Download](https://www.python.org/downloads/)
2. **Node.js 18+** - [Download](https://nodejs.org/)
3. **Ollama** - [Download](https://ollama.ai/download)
4. **Cloudinary Account** - [Sign up free](https://cloudinary.com/users/register/free)

### Installation

#### 1. Install Ollama and Download Model

```bash
# Install Ollama from https://ollama.ai/download
# Then pull the model
ollama pull qwen2.5:7b-instruct
```

#### 2. Setup Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env file
copy .env.example .env
# Edit .env with your Cloudinary credentials
```

#### 3. Setup Frontend

```bash
cd frontend
npm install
```

### Running the Application

**Open 3 terminals:**

**Terminal 1 - Start Ollama:**
```bash
ollama serve
```

**Terminal 2 - Start Backend:**
```bash
cd backend
python main.py
```
Backend runs on: http://localhost:8000

**Terminal 3 - Start Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: http://localhost:3000

### Windows Quick Start

Double-click these files:
- `start-backend.bat` - Starts the backend server
- `start-frontend.bat` - Starts the frontend app

(Make sure Ollama is running first!)

## 📁 Project Structure

```
ai-interviewer/
├── backend/                      # FastAPI Backend
│   ├── main.py                   # API routes & app
│   ├── config.py                 # Configuration
│   ├── models.py                 # Data models
│   ├── session_manager.py        # Session handling
│   ├── services/
│   │   └── ollama_service.py     # AI integration
│   └── utils/
│       ├── resume_parser.py      # Resume parsing
│       └── cloudinary_helper.py  # Cloud storage
│
├── frontend/                     # React Frontend
│   └── src/
│       ├── pages/                # Page components
│       ├── styles/               # CSS files
│       └── api/                  # API client
│
├── SETUP_GUIDE.md               # Detailed setup
├── API_DOCUMENTATION.md         # API reference
├── DEPLOYMENT.md                # Production guide
├── TESTING.md                   # Testing guide
└── TROUBLESHOOTING.md           # Common issues
```

## 🎮 How to Use

1. **Upload Resume**: Upload your PDF or DOCX resume
2. **Start Interview**: Click "Start AI Interview" button
3. **Answer Questions**: 12 questions, 15 seconds each
   - Use microphone 🎤 or type ⌨️ your answers
4. **Get Results**: View your score, strengths, and recommendation

## 🔧 Configuration

### Backend Environment Variables

Create `backend/.env`:
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

Get Cloudinary credentials from: https://cloudinary.com/console

## 📚 Documentation

- **[Setup Guide](SETUP_GUIDE.md)** - Detailed installation instructions
- **[API Documentation](API_DOCUMENTATION.md)** - Complete API reference
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment
- **[Testing Guide](TESTING.md)** - Testing strategies
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues & solutions
- **[Project Structure](PROJECT_STRUCTURE.md)** - Code organization

## 🎯 Application Flow

```
1. Resume Upload → Parse & Extract Skills → Store in Cloudinary
2. Start Interview → Initialize Session
3. For each question (12 total):
   - Generate AI question based on resume
   - User answers (15 seconds)
   - Evaluate answer with AI
   - Adjust difficulty
4. Final Report → Score, Strengths, Weaknesses, Recommendation
```

## 🧪 Testing

```bash
# Test backend
cd backend
curl http://localhost:8000/

# Test Ollama
curl http://localhost:11434/api/tags

# Test frontend
# Open http://localhost:3000 in browser
```

## 🐛 Troubleshooting

### Common Issues

**Ollama not connecting:**
```bash
ollama serve
ollama pull qwen2.5:7b-instruct
```

**Backend errors:**
- Check `.env` file exists
- Verify Cloudinary credentials
- Ensure Python 3.9+

**Frontend errors:**
- Run `npm install` in frontend folder
- Check backend is running on port 8000

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed solutions.

## 🚀 Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Docker deployment
- Cloud hosting (AWS, GCP, Azure)
- Nginx configuration
- SSL/TLS setup
- Performance optimization

## 📊 Performance

- **Resume Upload**: < 3 seconds
- **Question Generation**: 3-5 seconds (first request slower)
- **Answer Evaluation**: 3-5 seconds
- **Memory Usage**: ~500MB backend + ~6GB Ollama

## 🔒 Security

- Resume files stored securely in Cloudinary
- Local AI processing (data doesn't leave your machine)
- CORS protection
- Input validation
- File type restrictions

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional file format support
- Multi-language support
- Video recording
- Interview history/analytics
- Custom question templates

## 📝 License

This project is open source and available for educational purposes.

## 🙏 Acknowledgments

- **Ollama** - Local LLM runtime
- **Qwen Team** - Language model
- **FastAPI** - Web framework
- **React** - UI library
- **Cloudinary** - Cloud storage

## 📧 Support

Having issues? Check these resources:
1. [Troubleshooting Guide](TROUBLESHOOTING.md)
2. [Setup Guide](SETUP_GUIDE.md)
3. Browser console (F12) for frontend errors
4. Backend terminal for API errors

## 🎓 Use Cases

- **Job Seekers**: Practice technical interviews
- **Recruiters**: Screen candidates efficiently
- **Educators**: Assess student knowledge
- **Self-Assessment**: Identify skill gaps

---

**Built with ❤️ using modern web technologies and local AI**
