from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "GridSync API"
    version: str


class SearchRequest(BaseModel):
    query: str = Field(..., description="User query to search the vector DB.")
    k: int = Field(5, ge=1, le=50, description="Number of chunks to return.")


class ChunkRelationship(BaseModel):
    from_node: List[str] = Field(
        default_factory=list,
        description="Labels of the source node (the DocumentChunk).",
    )
    relationship: str = Field(..., description="Relationship type, e.g. MENTIONS.")
    to_node: List[str] = Field(
        default_factory=list,
        description="Labels of the target node, e.g. ['Event'].",
    )


class Chunk(BaseModel):
    id: Any
    score: float
    dense_score: Optional[float] = None
    sparse_score: Optional[float] = None
    rerank_score: float
    text: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    relationships: List[ChunkRelationship] = Field(
        default_factory=list,
        description="Neo4j graph edges adjacent to this chunk (when file_id and chunk_no are present).",
    )


class SearchResponse(BaseModel):
    query: str
    chunks: List[Chunk]


class AgentChatRequest(BaseModel):
    message: str = Field(..., description="User message to send to the main agent.")


class AgentToolCall(BaseModel):
    name: str
    args: Dict[str, Any] = Field(default_factory=dict)


class AgentChatResponse(BaseModel):
    reply: str
    tool_calls: List[AgentToolCall] = Field(default_factory=list)


class ChunkRelationshipsResponse(BaseModel):
    file_id: str
    chunk_num: str
    relationships: List[ChunkRelationship] = Field(default_factory=list)

