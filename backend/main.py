from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import *
from session_manager import session_manager
from services.gemini_service import gemini_service
from utils.resume_parser import parse_resume
from utils.cloudinary_helper import upload_resume
import uvicorn

app = FastAPI(title="AI Interviewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "AI Interviewer API is running"}


@app.post("/upload-resume", response_model=ResumeUploadResponse)
async def upload_resume_endpoint(file: UploadFile = File(...)):
    """Upload, parse full resume, extract skills, create session."""
    try:
        if not file.filename.lower().endswith(('.pdf', '.docx')):
            raise HTTPException(400, "Only PDF and DOCX files are supported")

        file_content = await file.read()
        print(f"File received: {file.filename}, size: {len(file_content)} bytes")

        resume_text = parse_resume(file_content, file.filename)
        print(f"Resume parsed, text length: {len(resume_text)} chars")

        if not resume_text or len(resume_text) < 50:
            raise HTTPException(400, "Resume content is too short or empty")

        upload_result = upload_resume(file_content, file.filename)
        print(f"Cloudinary upload: {upload_result['url']}")

        # Pass full resume text — no truncation
        skills = await gemini_service.extract_skills(resume_text)
        print(f"Skills extracted: {skills}")

        session_id = session_manager.create_session(
            resume_text=resume_text,
            resume_url=upload_result["url"],
            skills=skills
        )

        return ResumeUploadResponse(
            session_id=session_id,
            message="Resume uploaded successfully",
            resume_url=upload_result["url"]
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR in upload_resume: {type(e).__name__}: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Error processing resume: {str(e)}")


@app.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(session_id: str):
    """Generate all questions from full resume context before interview starts."""
    try:
        session = session_manager.get_session(session_id)

        print(f"Generating {session.total_questions} questions from full resume...")
        questions = await gemini_service.generate_questions(
            resume_text=session.resume_text,
            skills=session.skills,
            total_questions=session.total_questions
        )

        session.questions_queue = questions
        print(f"Generated {len(questions)} questions successfully.")

        return StartInterviewResponse(
            session_id=session_id,
            message="Interview started",
            total_questions=session.total_questions
        )

    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in start_interview: {type(e).__name__}: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Error starting interview: {str(e)}")


@app.get("/next-question", response_model=QuestionResponse)
async def get_next_question(session_id: str):
    """Return the next pre-generated question."""
    try:
        session = session_manager.get_session(session_id)

        if session.is_complete():
            raise HTTPException(400, "Interview already completed")

        if session.current_question_number >= len(session.questions_queue):
            raise HTTPException(400, "No more questions available")

        question = session.questions_queue[session.current_question_number]
        session.current_question = question

        return QuestionResponse(
            question_number=session.current_question_number + 1,
            question=question,
            total_questions=session.total_questions
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in next_question: {type(e).__name__}: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Error getting question: {str(e)}")


@app.post("/submit-answer", response_model=AnswerEvaluation)
async def submit_answer(submission: AnswerSubmission):
    """Store the answer as-is; evaluation happens at final-result."""
    try:
        session = session_manager.get_session(submission.session_id)

        if not hasattr(session, 'current_question') or not session.current_question:
            return AnswerEvaluation(
                score=0,
                feedback="Answer recorded.",
                is_last_question=session.is_complete()
            )

        # Store full answer — no truncation
        session.add_qa(
            question=session.current_question,
            answer=submission.answer,
            score=0,
            feedback="Pending evaluation.",
            topic="General"
        )
        session.current_question = None
        print(f"Answer {session.current_question_number} stored ({len(submission.answer)} chars)")

        return AnswerEvaluation(
            score=0,
            feedback="Answer recorded.",
            is_last_question=session.is_complete()
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in submit_answer: {type(e).__name__}: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Error storing answer: {str(e)}")


@app.get("/final-result", response_model=FinalReport)
async def get_final_result(session_id: str):
    """Evaluate all answers with full context and generate a real personalized report."""
    try:
        session = session_manager.get_session(session_id)

        if not session.is_complete():
            raise HTTPException(400, "Interview not yet completed")

        print(f"Evaluating {len(session.qa_history)} answers in one batch call...")

        evaluations = await gemini_service.evaluate_all_answers(
            qa_history=session.qa_history,
            resume_text=session.resume_text
        )

        total_score = 0
        for i, (qa, evaluation) in enumerate(zip(session.qa_history, evaluations)):
            qa["score"] = evaluation["score"]
            qa["feedback"] = evaluation["feedback"]
            qa["topic"] = evaluation.get("topic", "General")
            qa["strengths"] = evaluation.get("strengths", [])
            qa["improvements"] = evaluation.get("improvements", [])
            total_score += evaluation["score"]
            print(f"  Q{i+1} score: {qa['score']}/10 — {qa['topic']}")
        average_score = (total_score / len(session.qa_history)) * 10
        print(f"Overall score: {average_score:.1f}/100")

        report = await gemini_service.generate_final_report(
            qa_history=session.qa_history,
            resume_text=session.resume_text,
            total_score=average_score
        )

        return FinalReport(
            overall_score=report["overall_score"],
            strengths=report["strengths"],
            weaknesses=report["weaknesses"],
            recommendation=report["recommendation"],
            summary=report["summary"],
            total_questions=len(session.qa_history),
            topic_scores=report.get("topic_scores"),
            advice=report.get("advice"),
            qa_history=[
                {
                    "question_number": qa.get("question_number", i + 1),
                    "question": qa.get("question", ""),
                    "answer": qa.get("answer", ""),
                    "score": qa.get("score", 0),
                    "feedback": qa.get("feedback", ""),
                    "topic": qa.get("topic", "General")
                }
                for i, qa in enumerate(session.qa_history)
            ]
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in final_result: {type(e).__name__}: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(500, f"Error generating report: {str(e)}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
