import json
import os
from typing import List
from threading import Lock

BANK_FILE = os.path.join(os.path.dirname(__file__), "question_bank.json")
_lock = Lock()


class QuestionBank:
    """Persists all previously asked questions across sessions to avoid repetition."""

    def load(self) -> List[str]:
        with _lock:
            if not os.path.exists(BANK_FILE):
                return []
            try:
                with open(BANK_FILE, "r") as f:
                    data = json.load(f)
                    return data if isinstance(data, list) else []
            except Exception as e:
                print(f"[question_bank] load error: {e}")
                return []

    def save(self, questions: List[str]):
        with _lock:
            existing = self.load()
            # Deduplicate — case-insensitive check
            existing_lower = {q.lower() for q in existing}
            new_unique = [q for q in questions if q.lower() not in existing_lower]
            merged = existing + new_unique
            try:
                with open(BANK_FILE, "w") as f:
                    json.dump(merged, f, indent=2)
                print(f"[question_bank] saved {len(new_unique)} new questions (total: {len(merged)})")
            except Exception as e:
                print(f"[question_bank] save error: {e}")

    def get_recent(self, limit: int = 100) -> List[str]:
        """Return the most recent N questions to pass into the prompt."""
        all_q = self.load()
        return all_q[-limit:]


question_bank = QuestionBank()
