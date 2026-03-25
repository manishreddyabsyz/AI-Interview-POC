import httpx
import json
from typing import List, Dict
from config import settings

# Try to import Gemini, fallback to None if not available
try:
    import google.generativeai as genai
    if settings.GEMINI_API_KEY:
        genai.configure(api_key=settings.GEMINI_API_KEY)
        print(f"Gemini API Key configured: {settings.GEMINI_API_KEY[:10]}...")
    GEMINI_AVAILABLE = True
except ImportError:
    print("Gemini package not installed")
    GEMINI_AVAILABLE = False
except Exception as e:
    print(f"Error configuring Gemini: {e}")
    GEMINI_AVAILABLE = False

class OllamaService:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL
        self.use_gemini = settings.USE_GEMINI and GEMINI_AVAILABLE
        
        if self.use_gemini:
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
            print("Using Gemini API for AI generation")
        else:
            print(f"Using Ollama with model: {self.model}")
    
    async def generate_response(self, prompt: str, timeout: int = 120) -> str:
        """Generate response from Gemini or Ollama"""
        if self.use_gemini:
            try:
                print(f"Calling Gemini API with prompt length: {len(prompt)}")
                response = self.gemini_model.generate_content(prompt)
                print(f"Gemini response received: {len(response.text)} chars")
                return response.text
            except Exception as e:
                print(f"Gemini API error: {str(e)}")
                raise Exception(f"Gemini API error: {str(e)}")
        else:
            # Ollama fallback
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        f"{self.base_url}/api/generate",
                        json={
                            "model": self.model,
                            "prompt": prompt,
                            "stream": False
                        }
                    )
                    response.raise_for_status()
                    result = response.json()
                    return result.get("response", "")
            except httpx.ConnectError as e:
                raise Exception(f"Cannot connect to Ollama at {self.base_url}. Make sure Ollama is running with 'ollama serve'")
            except httpx.ReadTimeout as e:
                raise Exception(f"Ollama took too long to respond. Try using a smaller/faster model.")
            except httpx.HTTPStatusError as e:
                raise Exception(f"Ollama HTTP error: {e.response.status_code} - {e.response.text}")
            except Exception as e:
                raise Exception(f"Ollama API error: {str(e)}")
    
    async def extract_skills(self, resume_text: str) -> List[str]:
        """Extract skills from resume"""
        prompt = f"""List technical skills from this resume as JSON array.

Resume: {resume_text[:1500]}

Format: ["skill1", "skill2"]"""
        
        try:
            response = await self.generate_response(prompt)
            # Extract JSON from response
            start = response.find('[')
            end = response.rfind(']') + 1
            if start != -1 and end > start:
                skills = json.loads(response[start:end])
                return skills[:15]  # Limit to 15 skills
        except Exception as e:
            print(f"Skill extraction failed: {e}, using fallback")
        
        # Fallback: extract common keywords from resume
        common_skills = ["Python", "JavaScript", "Java", "C++", "SQL", "React", "Node.js", 
                        "AWS", "Docker", "Git", "API", "Database", "Machine Learning"]
        found_skills = [skill for skill in common_skills if skill.lower() in resume_text.lower()]
        return found_skills[:10] if found_skills else ["Programming", "Problem Solving", "Technical Skills"]
    
    async def generate_question(
        self, 
        resume_text: str, 
        skills: List[str],
        previous_qa: List[Dict],
        difficulty: str = "medium",
        question_index: int = 0
    ) -> str:
        """Generate interview question"""
        
        # Rotate through different skills to ensure variety
        skill_focus = skills[question_index % len(skills)] if skills else "general programming"
        
        # Different question types for variety
        question_types = [
            f"Explain how you would implement {skill_focus} in a real project.",
            f"What challenges have you faced with {skill_focus}?",
            f"Compare {skill_focus} with alternative approaches.",
            f"Describe a project where you used {skill_focus}.",
            f"How would you optimize performance using {skill_focus}?"
        ]
        
        question_type = question_types[question_index % len(question_types)]
        
        prompt = f"""Generate ONE specific technical question about {skill_focus}.

Style: {question_type}
Keep it practical and answerable in 30 seconds.

Question:"""
        
        question = await self.generate_response(prompt)
        return question.strip()[:200]  # Limit length

    async def evaluate_answer(
        self, 
        question: str, 
        answer: str,
        resume_text: str
    ) -> Dict:
        """Evaluate user's answer"""
        prompt = f"""Rate answer 0-10.

Q: {question[:80]}
A: {answer[:150]}

JSON: {{"score": <0-10>, "feedback": "<brief>", "topic": "<topic>"}}"""
        
        try:
            response = await self.generate_response(prompt, timeout=30)
            # Extract JSON from response
            start = response.find('{')
            end = response.rfind('}') + 1
            if start != -1 and end > start:
                evaluation = json.loads(response[start:end])
                return evaluation
        except Exception as e:
            print(f"Evaluation failed: {e}")
        
        # Fallback evaluation based on answer length
        score = 5
        if len(answer.strip()) > 50:
            score = 6
        if len(answer.strip()) > 100:
            score = 7
            
        return {
            "score": score,
            "feedback": "Answer recorded.",
            "topic": "General"
        }
    
    async def generate_final_report(
        self, 
        qa_history: List[Dict],
        total_score: float
    ) -> Dict:
        """Generate final evaluation report"""
        
        # Simple scoring without LLM to avoid timeout
        recommendation = "Hire" if total_score >= 70 else "No Hire" if total_score < 50 else "Maybe"
        
        # Extract topics from Q&A
        topics = list(set([qa.get("topic", "General") for qa in qa_history]))
        
        return {
            "overall_score": total_score,
            "strengths": [
                "Completed all questions",
                "Technical knowledge demonstrated",
                "Good communication"
            ],
            "weaknesses": [
                "Could provide more detailed answers",
                "Practice explaining concepts clearly"
            ],
            "recommendation": recommendation,
            "summary": f"Candidate scored {total_score:.1f}/100 across {len(qa_history)} questions covering {', '.join(topics[:3])}."
        }

ollama_service = OllamaService()
