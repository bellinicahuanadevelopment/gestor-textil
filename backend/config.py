import os

class Config:
    PORT = int(os.getenv("PORT", "5000"))
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173")
