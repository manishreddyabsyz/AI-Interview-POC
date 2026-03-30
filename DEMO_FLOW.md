# AI Interviewer — Complete Demo Flow & Technical Reference

## Project Overview

A full-stack AI-powered mock interview platform that:
1. Parses a candidate's resume
2. Generates personalized technical questions using Google Gemini
3. Conducts a proctored interview with live face detection and speech-to-text
4. Evaluates all answers in a single AI batch call
5. Produces a detailed PDF report with scores, feedback, and hiring recommendation

---

## Tech Stack at a Glance

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18.2.0 |
| Language (Frontend) | TypeScript | 5.3.3 |
| Build Tool | Vite | 5.0.11 |
| Routing | React Router DOM | 6.21.0 |
| HTTP Client | Axios | 1.6.5 |
| Face Detection | @vladmandic/face-api | 1.7.15 |
| Backend Framework | FastAPI | 0.109.0 |
| ASGI Server | Uvicorn | 0.27.0 |
| Language (Backend) | Python | 3.10+ |
| Data Validation | Pydantic | 2.5.3 |
| AI Model | Google Gemini (gemini-2.5-flash-lite) | google-genai >=1.0.0 |
| Resume Storage | Cloudinary | 1.38.0 |
| PDF Parsing | PyPDF2 | 3.0.1 |
| DOCX Parsing | python-docx | 1.1.0 |
| File Upload | python-multipart | 0.0.6 |
| Environment Config | python-dotenv | 1.0.0 |

---

## Architecture

```
Browser (React + TypeScript)
        │
        │  HTTP REST (Axios → localhost:8001)
        ▼
FastAPI Backend (Python)
        │
        ├── Cloudinary  →  Resume file storage (CDN)
        ├── Google Gemini API  →  AI question generation & evaluation
        └── In-memory SessionManager  →  Interview state per user
```

---

## Complete Application Flow

### Step 1 — Resume Upload (`/` → `ResumeUpload.tsx`)

**What happens on screen:**
- User drags & drops or browses for a PDF or DOCX resume (max 10 MB)
- File is validated client-side (type + size check)
- On submit, file is sent as `multipart/form-data` via Axios to `POST /upload-resume`

**What happens on the backend (`main.py → /upload-resume`):**
1. File extension validated (`.pdf` or `.docx` only)
2. `resume_parser.py` extracts raw text:
   - PDF → `PyPDF2.PdfReader` reads all pages
   - DOCX → `python-docx` reads all paragraphs
3. `cloudinary_helper.py` uploads the raw file bytes to Cloudinary under the `resumes/` folder using `resource_type="raw"` — returns a secure CDN URL
4. `gemini_service.extract_skills()` sends the full resume text to Gemini and asks for a JSON array of every technical skill, tool, and framework mentioned
   - Fallback: keyword scan against a hardcoded list of ~40 common tech terms
5. `SessionManager.create_session()` creates a UUID-based session in memory, storing: resume text, Cloudinary URL, and extracted skills
6. Returns `session_id` to the frontend, which stores it in `localStorage`

---

### Step 2 — Start Interview (`/start` → `StartInterview.tsx`)

**What happens on screen:**
- User sees interview rules: 5 questions, 30 seconds each, voice or text input
- Clicking "Start AI Interview" calls `POST /start-interview?session_id=...`
- Button shows "Generating questions... (this may take 1-2 minutes)" while waiting

**What happens on the backend (`/start-interview`):**
1. Session is retrieved from `SessionManager`
2. `gemini_service.generate_questions()` sends the full resume text + skills list to Gemini
3. Gemini is prompted to generate exactly 5 questions that:
   - Reference specific projects, tools, and outcomes from the resume
   - Cover different skills (no repeats)
   - Rotate through question styles: deep-dive, technical decision, challenge, how-it-works, business outcome
4. All 5 questions are stored in `session.questions_queue` upfront — no per-question API calls during the interview
5. Returns `total_questions: 5` to the frontend

**Why pre-generate?** Eliminates latency between questions. The user gets a smooth, uninterrupted experience.

---

### Step 3 — Interview (`/interview` → `InterviewScreen.tsx`)

This is the most complex screen. It runs three parallel systems simultaneously.

#### 3a. Camera & Microphone Permissions
- `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` is called on mount
- Stream is attached to a `<video>` element (muted, autoplay)
- If denied → shows a "Access Denied" gate with instructions to unblock in browser settings

#### 3b. Face Detection Proctoring (`@vladmandic/face-api` v1.7.15)
- Model used: `TinyFaceDetector` — a lightweight neural network (~190KB weights) loaded from `/public/models/`
- Runs `faceapi.detectAllFaces()` every 1.5 seconds using `inputSize: 224, scoreThreshold: 0.5`
- Logic:
  - 1 face detected → all clear
  - 0 faces → "You are not visible on camera" warning
  - 2+ faces → "Another person detected" warning
- Each violation increments a counter. At 3 violations → exam is terminated, user is locked out
- Warnings auto-clear after 5 seconds if the face situation resolves

#### 3c. Speech Recognition (Web Speech API — built into browser)
- Uses `window.SpeechRecognition` or `window.webkitSpeechRecognition` (Chrome/Edge)
- `continuous: true`, `interimResults: true`, `lang: 'en-US'`
- Interim results (grey text) shown live as the user speaks
- Final results appended to the answer textarea
- Processes only new results from `event.resultIndex` to avoid duplication bugs in the Web Speech API

#### 3d. Question Flow
- `GET /next-question?session_id=...` fetches the next pre-generated question from the queue
- A 30-second countdown timer starts for each question
- On timer expiry → `handleSubmit()` is called automatically
- User can also click "Submit & Next" manually
- Answer (voice transcript + any typed text) is sent to `POST /submit-answer`
  - Backend stores the answer as-is — no evaluation yet (score = 0, feedback = "Pending")
  - Returns `is_last_question: true` when all 5 are answered → frontend navigates to `/result`

---

### Step 4 — Results (`/result` → `ResultScreen.tsx`)

**What happens on screen:**
- Shows "Evaluating your answers and generating report..." spinner
- Calls `GET /final-result?session_id=...`

**What happens on the backend (`/final-result`):**

This is where all the AI evaluation happens in one shot.

1. **Batch evaluation** — `gemini_service.evaluate_all_answers()`:
   - Sends the full resume + all 5 Q&A pairs in a single Gemini call
   - Gemini scores each answer 0–10 using strict bands:
     - 0 = no answer / gibberish
     - 1–2 = wrong / no understanding
     - 3–4 = vague / surface-level
     - 5–6 = partially correct
     - 7–8 = good, minor gaps
     - 9–10 = excellent, hands-on depth
   - Returns per-answer: `score`, `feedback`, `topic`, `strengths`, `improvements`
   - Fallback: if batch fails, evaluates each answer individually

2. **Score calculation:**
   - `average_score = (sum of scores / number of questions) * 10` → 0–100 scale

3. **Final report** — `gemini_service.generate_final_report()`:
   - Sends resume + all scored Q&A to Gemini
   - Gemini writes a personalised summary referencing specific answers and projects
   - Returns: `overall_score`, `recommendation`, `summary`, `strengths`, `weaknesses`, `topic_scores`, `advice`
   - Recommendation thresholds:
     - ≥ 80 → Strong Hire
     - ≥ 65 → Hire
     - ≥ 50 → Maybe
     - < 50 → No Hire

**What the user sees:**
- Score circle (0–100)
- Colour-coded recommendation badge
- AI-written summary paragraph
- Strengths & weaknesses lists
- Topic-by-topic score bars
- Personalised advice
- PDF auto-downloads immediately on page load

#### PDF Report Generation
- Pure client-side — no library needed
- `window.open()` creates a new tab with a fully self-contained HTML document
- Includes: score circle, recommendation, summary, all Q&A with feedback, topic score bars, strengths/weaknesses, advice
- `window.print()` is called automatically; `window.onafterprint` closes the tab
- User can also click "Download Report" to regenerate it

---

## API Endpoints Summary

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Health check |
| POST | `/upload-resume` | Parse resume, extract skills, create session |
| POST | `/start-interview?session_id=` | Pre-generate all 5 questions |
| GET | `/next-question?session_id=` | Fetch next question from queue |
| POST | `/submit-answer` | Store answer (no evaluation yet) |
| GET | `/final-result?session_id=` | Batch evaluate + generate full report |

---

## Session Management

- Entirely in-memory (`SessionManager` class in `session_manager.py`)
- Each session stores: `resume_text`, `resume_url`, `skills`, `questions_queue`, `qa_history`, `current_question_number`, `difficulty`
- `difficulty` adapts dynamically: if last 3 answers average ≥ 8 → hard; ≤ 4 → easy (used in future question tuning)
- Sessions are identified by UUID v4 stored in browser `localStorage`
- No database — sessions are lost on server restart

---

## AI Prompting Strategy

### Skill Extraction
- Instructs Gemini to only list skills explicitly present in the resume (no hallucination)
- Falls back to keyword scan if JSON parsing fails

### Question Generation
- Strict rules: every question must reference a named project, tool, or result from the resume
- 5 different question styles rotated to avoid repetition
- Fallback chain: batch → fill remaining → one-by-one generation

### Answer Evaluation
- Single batch call for all answers (resume sent once, not 5 times)
- Strict scoring rubric with explicit examples of what earns each band
- Fallback to individual evaluation if batch JSON parsing fails

### Retry Logic
- All Gemini calls wrapped in `_call()` with 3 retries
- On HTTP 429 / `RESOURCE_EXHAUSTED`: extracts `retryDelay` from error message, waits up to 30 seconds between retries

---

## Environment Variables (`.env`)

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Running the Project

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8001
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

Or use the provided batch files: `start-backend.bat` / `start-frontend.bat`

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Pre-generate all questions before interview starts | Eliminates per-question API latency; smoother UX |
| Batch evaluate all answers at the end | Resume context sent once; cheaper and more consistent scoring |
| TinyFaceDetector (not full face-api model) | ~190KB vs ~6MB; loads fast in browser |
| In-memory sessions (no DB) | Simplicity for demo; trivial to swap for Redis/Postgres |
| PDF generated client-side | No server dependency; works offline after results load |
| Web Speech API (no third-party STT) | Zero cost, zero latency, works natively in Chrome/Edge |
