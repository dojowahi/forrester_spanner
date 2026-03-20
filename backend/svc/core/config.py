from __future__ import annotations
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Spanner Retail Nexus"
    APP_VERSION: str = "0.1.0"
    ALLOWED_HOSTS: list[str] = ["*"]
    
    # Spanner & GCS configuration (ported from .env)
    GCS_BUCKET: str = os.getenv("GCS_BUCKET", "")
    VERTEX_AI: bool = os.getenv("VERTEX_AI", "False").lower() == "true"
    PROJECT_ID: str = os.getenv("PROJECT_ID", "")
    MODEL_LOCATION: str = os.getenv("MODEL_LOCATION", "global")
    EMBEDDING_LOCATION: str = os.getenv("EMBEDDING_LOCATION", os.getenv("MODEL_LOCATION", "us-central1"))
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
