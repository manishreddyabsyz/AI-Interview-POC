# Testing Guide

## Manual Testing Checklist

### 1. Resume Upload Page

**Test Cases:**

✅ Upload valid PDF resume
- Expected: Success message, redirect to start page

✅ Upload valid DOCX resume
- Expected: Success message, redirect to start page

❌ Upload invalid file (e.g., .txt, .jpg)
- Expected: Error message "Only PDF and DOCX files are supported"

❌ Upload empty file
- Expected: Error message about empty content

❌ Upload without selecting file
- Expected: Error message "Please select a file"

✅ Upload large file (5-10 MB)
- Expected: Success (Cloudinary handles it)

### 2. Start Interview Page

**Test Cases:**

✅ Click "Start AI Interview"
- Expected: Redirect to interview screen

✅ Check interview instructions display
- Expected: Shows 12 questions, 15 seconds, voice/text options

❌ Access without session ID
- Expected: Redirect to upload page

### 3. Interview Screen

**Test Cases:**

✅ Question loads automatically
- Expected: Question appears, timer starts at 15

✅ Timer counts down
- Expected: Decreases from 15 to 0

✅ Type answer in text area
- Expected: Text appears, submit button enables

✅ Click microphone button
- Expected: Recording starts, button shows "Stop"

✅ Speak into microphone
- Expected: Text appears in answer area

✅ Submit answer before timer ends
- Expected: Feedback appears with score

✅ Timer reaches 0
- Expected: Auto-submit answer

✅ Click "Next Question"
- Expected: New question loads, timer resets

✅ Complete all 12 questions
- Expected: Redirect to results page

✅ Progress bar updates
- Expected: Shows correct percentage

### 4. Result Screen

**Test Cases:**

✅ View overall score
- Expected: Score out of 100 displayed

✅ View strengths
- Expected: List of 2-3 strengths

✅ View weaknesses
- Expected: List of 2-3 areas to improve

✅ View recommendation
- Expected: "Hire", "No Hire", or "Maybe"

✅ Click "Start New Interview"
- Expected: Redirect to upload page, new session

❌ Access without completing interview
- Expected: Error message

### 5. Browser Compatibility

Test in:
- ✅ Chrome (recommended)
- ✅ Edge
- ✅ Firefox
- ⚠️ Safari (speech recognition limited)

### 6. Responsive Design

Test on:
- ✅ Desktop (1920x1080)
- ✅ Laptop (1366x768)
- ✅ Tablet (768x1024)
- ✅ Mobile (375x667)

## API Testing

### Using cURL

#### 1. Upload Resume
```bash
curl -X POST http://localhost:8000/upload-resume \
  -F "file=@test_resume.pdf" \
  -v
```

Expected Response:
```json
{
  "session_id": "abc-123-def",
  "message": "Resume uploaded successfully",
  "resume_url": "https://res.cloudinary.com/..."
}
```

#### 2. Start Interview
```bash
curl -X POST "http://localhost:8000/start-interview?session_id=abc-123-def" \
  -v
```

Expected Response:
```json
{
  "session_id": "abc-123-def",
  "message": "Interview started",
  "total_questions": 12
}
```

#### 3. Get Question
```bash
curl "http://localhost:8000/next-question?session_id=abc-123-def" \
  -v
```

Expected Response:
```json
{
  "question_number": 1,
  "question": "What is your experience with Python?",
  "total_questions": 12
}
```

#### 4. Submit Answer
```bash
curl -X POST http://localhost:8000/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc-123-def",
    "question_number": 1,
    "answer": "I have 3 years of Python experience"
  }' \
  -v
```

Expected Response:
```json
{
  "score": 7,
  "feedback": "Good answer with specific experience",
  "is_last_question": false
}
```

#### 5. Get Final Result
```bash
curl "http://localhost:8000/final-result?session_id=abc-123-def" \
  -v
```

Expected Response:
```json
{
  "overall_score": 75.5,
  "strengths": ["Technical knowledge", "Communication"],
  "weaknesses": ["Advanced topics"],
  "recommendation": "Hire",
  "summary": "Strong candidate overall",
  "total_questions": 12
}
```

## Automated Testing

### Backend Unit Tests

Create `backend/test_api.py`:

```python
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "AI Interviewer API is running"

def test_upload_resume_no_file():
    response = client.post("/upload-resume")
    assert response.status_code == 422

def test_invalid_session():
    response = client.post("/start-interview?session_id=invalid")
    assert response.status_code == 404
```

Run tests:
```bash
cd backend
pytest test_api.py -v
```

### Frontend Component Tests

Create `frontend/src/tests/ResumeUpload.test.jsx`:

```javascript
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ResumeUpload from '../pages/ResumeUpload'

test('renders upload button', () => {
  render(
    <BrowserRouter>
      <ResumeUpload />
    </BrowserRouter>
  )
  expect(screen.getByText(/Upload & Continue/i)).toBeInTheDocument()
})

test('shows error for invalid file', () => {
  render(
    <BrowserRouter>
      <ResumeUpload />
    </BrowserRouter>
  )
  
  const file = new File(['test'], 'test.txt', { type: 'text/plain' })
  const input = screen.getByLabelText(/upload/i)
  
  fireEvent.change(input, { target: { files: [file] } })
  
  expect(screen.getByText(/Please upload a PDF or DOCX file/i)).toBeInTheDocument()
})
```

## Load Testing

### Using Apache Bench

```bash
# Test upload endpoint
ab -n 100 -c 10 -p resume.pdf -T multipart/form-data \
  http://localhost:8000/upload-resume

# Test question endpoint
ab -n 1000 -c 50 \
  http://localhost:8000/next-question?session_id=test-123
```

### Using Locust

Create `locustfile.py`:

```python
from locust import HttpUser, task, between

class InterviewUser(HttpUser):
    wait_time = between(1, 3)
    
    @task
    def upload_resume(self):
        files = {'file': open('test_resume.pdf', 'rb')}
        self.client.post("/upload-resume", files=files)
    
    @task
    def get_question(self):
        self.client.get("/next-question?session_id=test-123")
```

Run:
```bash
locust -f locustfile.py --host=http://localhost:8000
```

## Performance Benchmarks

### Expected Response Times

- Upload Resume: < 3 seconds
- Start Interview: < 500ms
- Get Question: < 5 seconds (Ollama processing)
- Submit Answer: < 5 seconds (Ollama evaluation)
- Final Result: < 5 seconds

### Resource Usage

- Backend Memory: ~200-500 MB
- Ollama Memory: ~4-8 GB (model loaded)
- Frontend Build: ~2 MB gzipped

## Common Issues & Solutions

### Issue: Ollama timeout
**Solution**: Increase timeout in `ollama_service.py`:
```python
async with httpx.AsyncClient(timeout=120.0) as client:
```

### Issue: Speech recognition not working
**Solution**: 
- Use Chrome/Edge browser
- Check microphone permissions
- Ensure HTTPS in production

### Issue: CORS errors
**Solution**: Verify backend CORS settings match frontend URL

### Issue: Large resume upload fails
**Solution**: Increase Cloudinary limits or add file size validation

## Test Data

### Sample Resume Content

Create `test_resume.txt`:
```
John Doe
Software Engineer

Skills:
- Python, JavaScript, React
- FastAPI, Node.js
- PostgreSQL, MongoDB
- AWS, Docker

Experience:
Senior Developer at Tech Corp (2020-2023)
- Built scalable web applications
- Led team of 5 developers
```

Convert to PDF for testing.

## Continuous Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.11'
      - run: |
          cd backend
          pip install -r requirements.txt
          pytest

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: |
          cd frontend
          npm install
          npm run build
```

## Security Testing

### Check for Vulnerabilities

Backend:
```bash
pip install safety
safety check -r requirements.txt
```

Frontend:
```bash
npm audit
npm audit fix
```

### Test File Upload Security

- ✅ Only PDF/DOCX accepted
- ✅ File size limits enforced
- ✅ Malicious file detection
- ✅ Cloudinary virus scanning

## Monitoring in Production

### Health Check Endpoint

```bash
curl http://localhost:8000/health
```

### Log Monitoring

```bash
tail -f backend/app.log
```

### Error Tracking

Consider integrating:
- Sentry for error tracking
- LogRocket for session replay
- Google Analytics for usage stats

## Test Coverage Goals

- Backend: > 80% coverage
- Frontend: > 70% coverage
- E2E: Critical user flows covered

Run coverage:
```bash
# Backend
pytest --cov=. --cov-report=html

# Frontend
npm run test -- --coverage
```
