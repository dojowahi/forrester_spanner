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

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Calculate path to frontend static dist (works inside container /app/static)
static_dir = os.path.join(os.path.dirname(__file__), "..", "..", "static")

if os.path.exists(static_dir):
    # Mount asset files
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

@app.get("/{full_path:path}", tags=["system"])
async def serve_spa(full_path: str):
    """Fallback handler mapping unspecified routes back to the React index.html"""
    if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404)
        
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r") as f:
            return HTMLResponse(content=f.read())
    return {"error": "Frontend not built or static directory not mapped"}

@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "service": settings.APP_NAME}
