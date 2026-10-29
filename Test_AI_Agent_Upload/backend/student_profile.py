"""Stable identity/context from the backend dataset; never a fallback for current school facts."""
import json
import os
from pathlib import Path


def profile_for(key: str | None, full_name: str | None = None):
    path = Path(os.getenv("MADRASATI_DATASET") or Path(__file__).resolve().parents[2] / "supabase/data/madrasati-dataset.json")
    try:
        students = json.loads(path.read_text(encoding="utf-8"))["students"]
        # Prefer the database's stable demo key; old call contexts may have only an exact full name.
        student = next((s for s in students if (s.get("id") == key if key else s.get("name") == full_name)), None)
        if not student or (full_name and student.get("name") != full_name):
            return {}
        return {k: student[k] for k in ("id", "name", "firstName", "grade", "stage", "classroom", "school") if k in student}
    except (OSError, ValueError, KeyError, TypeError):
        return {}
