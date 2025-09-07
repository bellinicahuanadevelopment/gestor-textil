import os
import json

def _parse_origins(val: str) -> list[str]:
    """Accepts comma-separated string OR JSON list; returns a list of origins."""
    if not val:
        return []
    s = val.strip()
    # JSON array form: '["https://a.com","https://b.com"]'
    if (s.startswith("[") and s.endswith("]")) or (s.startswith("(") and s.endswith(")")):
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                return [str(x).strip() for x in arr if str(x).strip()]
        except Exception:
            # fall back to CSV parsing below
            pass
    # CSV form: "https://a.com, https://b.com"
    return [part.strip() for part in s.split(",") if part.strip()]

class Config:
    PORT = int(os.getenv("PORT", "5000"))
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
    # FIX: only one default arg to getenv; then parse into a list
    CORS_ORIGINS = _parse_origins(
        os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,https://demotextiles.onrender.com"
        )
    )