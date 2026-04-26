from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router as api_router
from app.settings import settings

app = FastAPI(title="GridSync API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/", tags=["system"])
def root():
    return {
        "message": "GridSync FastAPI backend is running.",
        "docs": "/docs",
        "health": "/health",
    }
