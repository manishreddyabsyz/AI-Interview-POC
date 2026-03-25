@echo off
echo Starting AI Interviewer Backend...
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8001
pause
