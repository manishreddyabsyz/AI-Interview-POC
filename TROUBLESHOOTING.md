# Troubleshooting Guide

## Common Issues and Solutions

### 1. Backend Won't Start

#### Error: "ModuleNotFoundError: No module named 'fastapi'"

**Solution:**
```bash
cd backend
pip install -r requirements.txt
```

#### Error: "Address already in use"

**Solution:**
```bash
# Windows - Find and kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Or change port in main.py
uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
```

#### Error: "No module named 'dotenv'"

**Solution:**
```bash
pip install python-dotenv
```

---

### 2. Ollama Connection Issues

#### Error: "Ollama API error: Connection refused"

**Solution:**
```bash
# Start Ollama service
ollama serve

# Verify it's running
curl http://localhost:11434/api/tags
```

#### Error: "Model not found"

**Solution:**
```bash
# Pull the required model
ollama pull qwen2.5:7b-instruct

# Verify model is downloaded
ollama list
```

#### Error: "Ollama timeout"

**Solution:**
Increase timeout in `backend/services/ollama_service.py`:
```python
async with httpx.AsyncClient(timeout=120.0) as client:
```

#### Ollama is slow

**Causes:**
- First request loads model into memory (30-60 seconds)
- Insufficient RAM (needs 8GB+)
- CPU-only inference (GPU recommended)

**Solutions:**
- Wait for first request to complete
- Keep Ollama running (model stays in memory)
- Use smaller model: `ollama pull qwen2.5:3b-instruct`
- Add GPU support if available

---

### 3. Cloudinary Upload Errors

#### Error: "Invalid credentials"

**Solution:**
1. Check `.env` file exists in backend folder
2. Verify credentials from Cloudinary dashboard
3. Ensure no extra spaces in .env values
```env
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_API_KEY=123456789
CLOUDINARY_API_SECRET=abcdefghijk
```

#### Error: "File too large"

**Solution:**
- Free tier limit: 10MB per file
- Upgrade Cloudinary plan or
- Add file size validation in frontend

#### Error: "Upload failed"

**Solution:**
- Check internet connection
- Verify Cloudinary account is active
- Check API rate limits

---

### 4. Frontend Issues

#### Error: "npm: command not found"

**Solution:**
Install Node.js from https://nodejs.org/

#### Error: "Cannot find module 'react'"

**Solution:**
```bash
cd frontend
npm install
```

#### Error: "Port 3000 is already in use"

**Solution:**
```bash
# Kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
# Edit package.json scripts:
"dev": "vite --port 3001"
```

#### Error: "Network Error" when calling API

**Solution:**
1. Verify backend is running on port 8000
2. Check CORS settings in `backend/main.py`
3. Verify API URL in `frontend/src/api/api.js`

---

### 5. Resume Upload Issues

#### Error: "Resume content is too short or empty"

**Causes:**
- Scanned PDF (image-based, no text)
- Encrypted PDF
- Corrupted file

**Solutions:**
- Use text-based PDF
- Convert scanned PDF with OCR
- Try different resume file

#### Error: "Unsupported file format"

**Solution:**
- Only PDF and DOCX supported
- Convert other formats to PDF
- Check file extension is correct

#### PDF parsing returns gibberish

**Solution:**
- PDF might have encoding issues
- Try re-saving PDF
- Use "Save As" → PDF in Word

---

### 6. Speech Recognition Issues

#### Microphone not working

**Solutions:**
1. **Check browser permissions:**
   - Chrome: Settings → Privacy → Site Settings → Microphone
   - Allow microphone access for localhost

2. **Browser compatibility:**
   - Use Chrome or Edge (best support)
   - Firefox has limited support
   - Safari requires HTTPS

3. **HTTPS requirement:**
   - Speech API requires HTTPS in production
   - localhost works without HTTPS

#### Speech recognition not accurate

**Solutions:**
- Speak clearly and slowly
- Reduce background noise
- Use external microphone
- Fallback: Type answer manually

#### Error: "Speech recognition not supported"

**Solution:**
- Use Chrome or Edge browser
- Update browser to latest version
- Use text input as alternative

---

### 7. Interview Flow Issues

#### Questions not loading

**Checks:**
1. Backend is running
2. Ollama is running
3. Session ID is valid
4. Check browser console for errors

**Solution:**
```bash
# Check backend logs
cd backend
python main.py

# Look for error messages
```

#### Timer not working

**Solution:**
- Check browser console for JavaScript errors
- Refresh page
- Clear browser cache

#### Stuck on loading screen

**Causes:**
- Ollama taking too long
- Network timeout
- Backend error

**Solutions:**
- Wait 60 seconds (first Ollama request)
- Check backend logs
- Restart Ollama service

---

### 8. Result Screen Issues

#### Error: "Interview not yet completed"

**Solution:**
- Complete all 12 questions first
- Don't skip questions
- Check session hasn't expired

#### Results not displaying

**Solution:**
- Check browser console
- Verify session ID in localStorage
- Check backend logs for errors

---

### 9. Development Issues

#### Hot reload not working

**Frontend:**
```bash
# Restart Vite dev server
npm run dev
```

**Backend:**
```bash
# Ensure reload=True in main.py
uvicorn.run("main:app", reload=True)
```

#### Changes not reflecting

**Solution:**
- Clear browser cache (Ctrl+Shift+R)
- Check file is saved
- Restart dev server

---

### 10. Production Issues

#### CORS errors in production

**Solution:**
Update `backend/main.py`:
```python
allow_origins=["https://yourdomain.com"]
```

#### API calls failing

**Checks:**
1. Backend is running and accessible
2. Firewall allows port 8000
3. HTTPS configured correctly
4. Environment variables set

#### Slow performance

**Solutions:**
- Use production build: `npm run build`
- Enable gzip compression
- Use CDN for static files
- Optimize Ollama (GPU, more RAM)

---

## Debugging Tips

### Backend Debugging

**Enable detailed logging:**
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Test endpoints with cURL:**
```bash
curl -v http://localhost:8000/
```

**Check Ollama directly:**
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "qwen2.5:7b-instruct",
  "prompt": "Hello"
}'
```

### Frontend Debugging

**Check browser console:**
- F12 → Console tab
- Look for errors (red text)

**Check network requests:**
- F12 → Network tab
- Filter by XHR
- Check request/response

**React DevTools:**
- Install React DevTools extension
- Inspect component state

### Session Debugging

**Check session ID:**
```javascript
console.log(localStorage.getItem('sessionId'))
```

**Clear session:**
```javascript
localStorage.removeItem('sessionId')
```

---

## Performance Issues

### Ollama is slow

**Optimization:**
1. Use GPU if available
2. Increase RAM allocation
3. Use smaller model
4. Keep Ollama running (model stays loaded)

### Backend is slow

**Optimization:**
1. Use production server (Gunicorn)
2. Enable caching
3. Optimize database queries
4. Use async operations

### Frontend is slow

**Optimization:**
1. Build for production: `npm run build`
2. Enable code splitting
3. Lazy load components
4. Optimize images

---

## Getting Help

### Check Logs

**Backend:**
```bash
cd backend
python main.py
# Watch for error messages
```

**Frontend:**
```bash
cd frontend
npm run dev
# Check terminal output
```

**Ollama:**
```bash
ollama serve
# Check for model loading messages
```

### Verify Setup

**Backend:**
```bash
curl http://localhost:8000/
# Should return: {"message": "AI Interviewer API is running"}
```

**Ollama:**
```bash
curl http://localhost:11434/api/tags
# Should return list of models
```

### Common Commands

**Restart everything:**
```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: Backend
cd backend
python main.py

# Terminal 3: Frontend
cd frontend
npm run dev
```

**Clean install:**
```bash
# Backend
cd backend
pip uninstall -r requirements.txt -y
pip install -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## Still Having Issues?

1. **Check all services are running:**
   - Ollama on port 11434
   - Backend on port 8000
   - Frontend on port 3000

2. **Verify environment:**
   - Python 3.9+
   - Node.js 18+
   - Ollama installed

3. **Check configuration:**
   - `.env` file exists and correct
   - Cloudinary credentials valid
   - Model downloaded

4. **Review logs:**
   - Backend terminal output
   - Browser console
   - Network tab in DevTools

5. **Try minimal test:**
   - Upload simple PDF
   - Check if it reaches backend
   - Verify Ollama responds

6. **Create GitHub issue:**
   - Include error messages
   - Describe steps to reproduce
   - Share relevant logs
