import os
from dotenv import load_dotenv

# Load environment variables from Workspace Root .env
# This assumes running from root, or looks up hierarchy
load_dotenv()

class Settings:
    IMAGE_MODEL: str = os.getenv("IMAGE_MODEL", "gemini-3.1-flash-image-preview")
    TEXT_MODEL: str = os.getenv("TEXT_MODEL", "gemini-3.1-flash-lite-preview")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
    GCS_BUCKET: str = os.getenv("GCS_BUCKET", "gen-ai-4all-live-retail-images")
    VERTEX_AI: bool = os.getenv("VERTEX_AI", "False").lower() == "true"
    PROJECT_ID: str = os.getenv("PROJECT_ID", "")
    MODEL_LOCATION: str = os.getenv("MODEL_LOCATION", "")
    EMBEDDING_LOCATION: str = os.getenv("EMBEDDING_LOCATION", os.getenv("MODEL_LOCATION", "us-central1"))

settings = Settings()
