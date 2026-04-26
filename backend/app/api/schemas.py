from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "GridSync API"
    version: str


class SearchRequest(BaseModel):
    query: str = Field(..., description="User query to search the vector DB.")
    k: int = Field(5, ge=1, le=50, description="Number of chunks to return.")


class Chunk(BaseModel):
    id: Any
    score: float
    dense_score: Optional[float] = None
    sparse_score: Optional[float] = None
    rerank_score: float
    text: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    query: str
    chunks: List[Chunk]


class AgentChatRequest(BaseModel):
    message: str = Field(..., description="User message to send to the dummy agent.")


class AgentToolCall(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class AgentChatResponse(BaseModel):
    reply: str
    tool_calls: List[AgentToolCall] = Field(default_factory=list)
