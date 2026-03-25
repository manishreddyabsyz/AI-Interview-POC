# Quick Reference Card

## 🚀 Quick Start Commands

### First Time Setup
```bash
# 1. Install Ollama model
ollama pull qwen2.5:7b-instruct

# 2. Setup backend
cd backend
pip install -r requirements.txt
copy .env.example .env
# Edit .env with Cloudinary credentials

# 3. Setup frontend
cd frontend
npm install
```

### Daily Development
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start Backend
cd backend
python main.py

# Terminal 3: Start Frontend
cd frontend
npm run dev
```

## 🔗 URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React app |
| Backend | http://localhost:8000 | FastAPI server |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Ollama | http://localhost:11434 | LLM service |

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/main.py` | API routes |
| `backend/config.py` | Configuration |
| `backend/.env` | Secrets (create from .env.example) |
| `backend/services/ollama_service.py` | AI logic |
| `frontend/src/App.jsx` | React router |
| `frontend/src/pages/InterviewScreen.jsx` | Main interview UI |
| `frontend/src/api/api.js` | API client |

## 🔧 Environment Variables

```env
# backend/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload-resume` | Upload resume file |
| POST | `/start-interview` | Initialize session |
| GET | `/next-question` | Get next question |
| POST | `/submit-answer` | Submit answer |
| GET | `/final-result` | Get final report |

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Ollama not connecting | Run `ollama serve` |
| Model not found | Run `ollama pull qwen2.5:7b-instruct` |
| Backend won't start | Check `.env` file exists |
| Frontend errors | Run `npm install` in frontend folder |
| Port already in use | Kill process or change port |
| CORS errors | Check backend is on port 8000 |

## 🧪 Quick Tests

```bash
# Test backend
curl http://localhost:8000/

# Test Ollama
curl http://localhost:11434/api/tags

# Test upload (replace with your file)
curl -X POST http://localhost:8000/upload-resume -F "file=@resume.pdf"
```

## 📦 Dependencies

### Backend
- fastapi
- uvicorn
- PyPDF2
- python-docx
- cloudinary
- httpx

### Frontend
- react
- react-router-dom
- axios
- vite

## 🎯 Application Flow

```
1. Upload Resume (PDF/DOCX)
   ↓
2. Extract Skills with AI
   ↓
3. Start Interview (12 questions)
   ↓
4. For each question:
   - AI generates question
   - User answers (15 seconds)
   - AI evaluates answer
   - Difficulty adjusts
   ↓
5. Final Report
   - Overall score
   - Strengths
   - Weaknesses
   - Recommendation
```

## 🔑 Key Features

- ✅ PDF/DOCX resume parsing
- ✅ AI question generation
- ✅ Voice recognition
- ✅ 15-second timer
- ✅ Adaptive difficulty
- ✅ Comprehensive evaluation

## 📊 Scoring System

- **Per Question**: 0-10 points
- **Overall Score**: Average × 10 (0-100)
- **Recommendation**:
  - 70+: Hire
  - 50-69: Maybe
  - <50: No Hire

## 🎨 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite |
| Backend | FastAPI + Python |
| AI | Ollama + Qwen2.5 |
| Storage | Cloudinary |
| Voice | Web Speech API |

## 📚 Documentation Files

| File | Content |
|------|---------|
| README.md | Project overview |
| SETUP_GUIDE.md | Detailed setup |
| API_DOCUMENTATION.md | API reference |
| DEPLOYMENT.md | Production guide |
| TESTING.md | Testing guide |
| TROUBLESHOOTING.md | Common issues |
| PROJECT_STRUCTURE.md | Code organization |
| FEATURES.md | Feature list |

## 🔒 Security Notes

- Store secrets in `.env` (never commit!)
- Use HTTPS in production
- Validate all file uploads
- Sanitize user inputs
- Enable CORS only for trusted domains

## 🚀 Production Checklist

- [ ] Update CORS settings
- [ ] Set production environment variables
- [ ] Use Gunicorn for backend
- [ ] Build frontend: `npm run build`
- [ ] Setup SSL/TLS
- [ ] Configure firewall
- [ ] Setup monitoring
- [ ] Enable logging
- [ ] Setup backups
- [ ] Test thoroughly

## 💡 Tips

1. **First Ollama request is slow** (30-60s) - model loads into memory
2. **Keep Ollama running** - subsequent requests are fast
3. **Use Chrome/Edge** - best speech recognition support
4. **Check browser console** - for frontend debugging
5. **Check terminal output** - for backend debugging

## 🆘 Getting Help

1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review browser console (F12)
3. Check backend terminal output
4. Verify all services are running
5. Test with cURL commands

## 📞 Support Resources

- **Ollama Docs**: https://ollama.ai/docs
- **FastAPI Docs**: https://fastapi.tiangolo.com
- **React Docs**: https://react.dev
- **Cloudinary Docs**: https://cloudinary.com/documentation

## 🎓 Learning Resources

- **FastAPI Tutorial**: https://fastapi.tiangolo.com/tutorial/
- **React Tutorial**: https://react.dev/learn
- **Ollama Guide**: https://github.com/ollama/ollama
- **Web Speech API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API

---

**Keep this card handy for quick reference during development!**
