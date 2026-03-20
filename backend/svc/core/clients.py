from google import genai
from google.cloud import spanner
from backend.svc.core.config import settings

# --- Initialize Clients ---
print("Initializing Spanner and AI Clients for backend...")

spanner_client = spanner.Client(disable_builtin_metrics=True)
# Defaults mapping to your live retail demo variables
instance = spanner_client.instance("live-retail-geo")
database = instance.database("spanner-demo-db")

ai_client = genai.Client(
    vertexai=settings.VERTEX_AI,
    project=settings.PROJECT_ID if settings.PROJECT_ID else None,
    location=settings.MODEL_LOCATION if settings.MODEL_LOCATION else None
)

embedding_client = genai.Client(
    vertexai=settings.VERTEX_AI,
    project=settings.PROJECT_ID if settings.PROJECT_ID else None,
    location=settings.EMBEDDING_LOCATION if hasattr(settings, 'EMBEDDING_LOCATION') and settings.EMBEDDING_LOCATION else None
)
