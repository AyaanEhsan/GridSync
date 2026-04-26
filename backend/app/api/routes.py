from fastapi import APIRouter

from app.api.schemas import AskRequest, AskResponse, HealthResponse
from app.rag.agent import query as run_query

router = APIRouter()

API_VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    return HealthResponse(version=API_VERSION)
