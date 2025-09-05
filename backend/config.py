# backend/config.py
import os

def _parse_origins(val: str):
    # Turn "https://a.com, https://b.com" into ["https://a.com", "https://b.com"]
    return [o.strip() for o in (val or "").split(",") if o.strip()]

class Config:
    # other settings...
    DATABASE_URL = os.getenv("DATABASE_URL")
    JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")

    # Single default string, comma-separated
    _RAW_CORS = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,https://demotextiles.onrender.com"
    )
    CORS_ORIGINS = _parse_origins(_RAW_CORS)
