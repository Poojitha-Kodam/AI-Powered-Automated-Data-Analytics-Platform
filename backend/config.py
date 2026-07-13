import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Automated Data Analytics Platform"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./analytics_platform.db"
    
    # LLM Settings (can be overridden by user in settings screen)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    DEFAULT_LLM_PROVIDER: str = "gemini"  # or 'openai', 'anthropic'
    DEFAULT_LLM_MODEL: str = "gemini-3.5-flash"
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-key-for-local-analytics-platform")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Upload Settings
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")

settings = Settings()

# Ensure upload directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
