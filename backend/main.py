import os
import shutil
from dotenv import load_dotenv

# Ensure Git is discoverable in PATH on Windows
if not shutil.which("git"):
    for git_candidate in [
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Git\cmd"),
        r"C:\Program Files\Git\cmd",
        r"C:\Program Files (x86)\Git\cmd",
    ]:
        if os.path.exists(git_candidate) and git_candidate not in os.environ.get("PATH", ""):
            os.environ["PATH"] = git_candidate + os.pathsep + os.environ.get("PATH", "")
            break

# Load environment variables from .env
for env_path in [".env", "backend/.env", "/app/.env"]:
    if os.path.exists(env_path):
        load_dotenv(env_path)
        break

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router as api_router

app = FastAPI(
    title="ML Paper Reproducibility Platform API",
    description="Backend service for automated paper claim extraction and code reproducibility scoring.",
    version="0.1.0"
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
from fastapi import Request

# Register routes
app.include_router(api_router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": f"Backend server error: {str(exc)}"}
    )


@app.get("/")
async def root():
    return {
        "message": "Welcome to ML Paper Reproducibility API",
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
