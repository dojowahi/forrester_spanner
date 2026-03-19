from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.svc.core.config import settings
from backend.svc.routes.views import router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(router, prefix="/api/v1")

@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
