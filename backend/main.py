from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import *
from session_manager import session_manager
from services.ollama_service import ollama_service
from utils.resume_parser import parse_resume
from utils.cloudinary_helper import upload_resume
import uvicorn

app = FastAPI(title="AI Interviewer API")

# CORS middleware
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
    """Upload and parse resume"""
    try:
        # Validate file type
        if not file.filename.lower().endswith(('.pdf', '.docx')):
            raise HTTPException(400, "Only PDF and DOCX files are supported")
        
        # Read file content
        file_content = await file.read()
        print(f"File received: {file.filename}, size: {len(file_content)} bytes")
        
        # Parse resume text
        resume_text = parse_resume(file_content, file.filename)
        print(f"Resume parsed, text length: {len(resume_text)}")
        
        if not resume_text or len(resume_text) < 50:
            raise HTTPException(400, "Resume content is too short or empty")
        
        # Upload to Cloudinary
        print("Uploading to Cloudinary...")
        upload_result = upload_resume(file_content, file.filename)
        print(f"Cloudinary upload successful: {upload_result['url']}")
        
        # Extract skills using Ollama
        print("Extracting skills with Ollama...")
        skills = await ollama_service.extract_skills(resume_text)
        print(f"Skills extracted: {skills}")
        
        # Create session
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
        print(f"ERROR: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error processing resume: {str(e)}")

@app.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(session_id: str):
    """Initialize interview session and generate all questions"""
    try:
        session = session_manager.get_session(session_id)
        
        # Generate all 5 questions at once
        print("Generating all 5 questions...")
        questions = []
        
        for i in range(session.total_questions):
            try:
                question = await ollama_service.generate_question(
                    resume_text=session.resume_text,
                    skills=session.skills,
                    previous_qa=[],
                    difficulty=session.difficulty,
                    question_index=i  # Pass index for variety
                )
                questions.append(question)
                print(f"Generated question {i+1}/5")
            except Exception as e:
                print(f"Error generating question {i+1}: {e}")
                # Fallback question
                skill = session.skills[i % len(session.skills)]
                fallback_questions = [
                    f"Explain your experience with {skill}.",
                    f"How do you handle errors in {skill}?",
                    f"What's your approach to testing {skill} code?",
                    f"Describe a challenging problem you solved using {skill}.",
                    f"How would you explain {skill} to a junior developer?"
                ]
                questions.append(fallback_questions[i % len(fallback_questions)])
        
        session.questions_queue = questions
        print("All questions generated successfully!")
        
        return StartInterviewResponse(
            session_id=session_id,
            message="Interview started",
            total_questions=session.total_questions
        )
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in start_interview: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error starting interview: {str(e)}")


@app.get("/next-question", response_model=QuestionResponse)
async def get_next_question(session_id: str):
    """Get next pre-generated question"""
    try:
        session = session_manager.get_session(session_id)
        
        if session.is_complete():
            raise HTTPException(400, "Interview already completed")
        
        # Get question from pre-generated queue
        if session.current_question_number < len(session.questions_queue):
            question = session.questions_queue[session.current_question_number]
            session.current_question = question
            
            return QuestionResponse(
                question_number=session.current_question_number + 1,
                question=question,
                total_questions=session.total_questions
            )
        else:
            raise HTTPException(400, "No more questions available")
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in next_question: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error getting question: {str(e)}")

@app.post("/submit-answer", response_model=AnswerEvaluation)
async def submit_answer(submission: AnswerSubmission):
    """Store answer without evaluation"""
    try:
        session = session_manager.get_session(submission.session_id)
        
        # Check if there's an active question
        if not hasattr(session, 'current_question') or not session.current_question:
            return AnswerEvaluation(
                score=0,
                feedback="Answer recorded.",
                is_last_question=session.is_complete()
            )
        
        # Just store the answer without evaluation
        session.add_qa(
            question=session.current_question,
            answer=submission.answer,
            score=0,  # Will be evaluated at the end
            feedback="Answer recorded.",
            topic="General"
        )
        
        # Clear current question
        session.current_question = None
        
        print(f"Answer {session.current_question_number} stored")
        
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
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error storing answer: {str(e)}")

@app.get("/final-result", response_model=FinalReport)
async def get_final_result(session_id: str):
    """Evaluate all answers and generate final report"""
    try:
        session = session_manager.get_session(session_id)
        
        if not session.is_complete():
            raise HTTPException(400, "Interview not yet completed")
        
        print("Evaluating all answers...")
        
        # Evaluate all answers at once
        total_score = 0
        for i, qa in enumerate(session.qa_history):
            try:
                evaluation = await ollama_service.evaluate_answer(
                    question=qa["question"],
                    answer=qa["answer"],
                    resume_text=session.resume_text
                )
                qa["score"] = evaluation["score"]
                qa["feedback"] = evaluation["feedback"]
                qa["topic"] = evaluation.get("topic", "General")
                total_score += evaluation["score"]
                print(f"Evaluated answer {i+1}/{len(session.qa_history)}: {evaluation['score']}/10")
            except Exception as e:
                print(f"Error evaluating answer {i+1}: {e}")
                qa["score"] = 5
                total_score += 5
        
        # Calculate average score (out of 100)
        average_score = (total_score / len(session.qa_history)) * 10
        
        # Generate final report
        print("Generating final report...")
        report = await ollama_service.generate_final_report(
            qa_history=session.qa_history,
            total_score=average_score
        )
        
        return FinalReport(
            overall_score=report["overall_score"],
            strengths=report["strengths"],
            weaknesses=report["weaknesses"],
            recommendation=report["recommendation"],
            summary=report["summary"],
            total_questions=len(session.qa_history)
        )
    
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        print(f"ERROR in final_result: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Error generating report: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
