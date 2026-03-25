# AI Interviewer API Documentation

Base URL: `http://localhost:8000`

## Endpoints

### 1. Upload Resume

**POST** `/upload-resume`

Upload and parse a resume file (PDF or DOCX).

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (PDF or DOCX file)

**Response:**
```json
{
  "session_id": "uuid-string",
  "message": "Resume uploaded successfully",
  "resume_url": "https://cloudinary.com/..."
}
```

**Status Codes:**
- 200: Success
- 400: Invalid file format or empty resume
- 500: Server error

---

### 2. Start Interview

**POST** `/start-interview?session_id={session_id}`

Initialize an interview session.

**Query Parameters:**
- `session_id` (required): Session ID from resume upload

**Response:**
```json
{
  "session_id": "uuid-string",
  "message": "Interview started",
  "total_questions": 12
}
```

**Status Codes:**
- 200: Success
- 404: Invalid session ID
- 500: Server error

---

### 3. Get Next Question

**GET** `/next-question?session_id={session_id}`

Generate and retrieve the next interview question.

**Query Parameters:**
- `session_id` (required): Session ID

**Response:**
```json
{
  "question_number": 1,
  "question": "Can you explain the difference between let and const in JavaScript?",
  "total_questions": 12
}
```

**Status Codes:**
- 200: Success
- 400: Interview already completed
- 404: Invalid session ID
- 500: Server error

---

### 4. Submit Answer

**POST** `/submit-answer`

Submit and evaluate an answer to the current question.

**Request Body:**
```json
{
  "session_id": "uuid-string",
  "question_number": 1,
  "answer": "User's answer text"
}
```

**Response:**
```json
{
  "score": 8,
  "feedback": "Good explanation with clear examples",
  "is_last_question": false
}
```

**Status Codes:**
- 200: Success
- 400: No active question
- 404: Invalid session ID
- 500: Server error

---

### 5. Get Final Result

**GET** `/final-result?session_id={session_id}`

Retrieve the final interview evaluation report.

**Query Parameters:**
- `session_id` (required): Session ID

**Response:**
```json
{
  "overall_score": 75.5,
  "strengths": [
    "Strong technical knowledge",
    "Clear communication",
    "Good problem-solving skills"
  ],
  "weaknesses": [
    "Could improve on advanced topics",
    "More practice with system design"
  ],
  "recommendation": "Hire",
  "summary": "Candidate demonstrated solid technical skills and good communication. Recommended for hire with some areas for growth.",
  "total_questions": 12
}
```

**Status Codes:**
- 200: Success
- 400: Interview not completed
- 404: Invalid session ID
- 500: Server error

---

## Data Models

### ResumeUploadResponse
```typescript
{
  session_id: string
  message: string
  resume_url: string
}
```

### StartInterviewResponse
```typescript
{
  session_id: string
  message: string
  total_questions: number
}
```

### QuestionResponse
```typescript
{
  question_number: number
  question: string
  total_questions: number
}
```

### AnswerSubmission
```typescript
{
  session_id: string
  question_number: number
  answer: string
}
```

### AnswerEvaluation
```typescript
{
  score: number  // 0-10
  feedback: string
  is_last_question: boolean
}
```

### FinalReport
```typescript
{
  overall_score: number  // 0-100
  strengths: string[]
  weaknesses: string[]
  recommendation: string  // "Hire" | "No Hire" | "Maybe"
  summary: string
  total_questions: number
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "detail": "Error message description"
}
```

Common error codes:
- 400: Bad Request (invalid input)
- 404: Not Found (invalid session)
- 500: Internal Server Error

---

## Interview Flow

1. **Upload Resume** → Get `session_id`
2. **Start Interview** → Initialize session
3. **Loop (12 times):**
   - Get Next Question
   - User answers (15 seconds)
   - Submit Answer
   - Receive feedback
4. **Get Final Result** → View evaluation

---

## Rate Limiting

Currently no rate limiting implemented. For production:
- Implement rate limiting per IP
- Add authentication
- Set request timeouts

---

## CORS Configuration

Currently allows all origins (`*`) for development.

For production, update CORS settings in `main.py`:
```python
allow_origins=["https://yourdomain.com"]
```

---

## Testing with cURL

### Upload Resume
```bash
curl -X POST http://localhost:8000/upload-resume \
  -F "file=@resume.pdf"
```

### Start Interview
```bash
curl -X POST "http://localhost:8000/start-interview?session_id=YOUR_SESSION_ID"
```

### Get Question
```bash
curl "http://localhost:8000/next-question?session_id=YOUR_SESSION_ID"
```

### Submit Answer
```bash
curl -X POST http://localhost:8000/submit-answer \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "YOUR_SESSION_ID",
    "question_number": 1,
    "answer": "My answer here"
  }'
```

### Get Results
```bash
curl "http://localhost:8000/final-result?session_id=YOUR_SESSION_ID"
```
