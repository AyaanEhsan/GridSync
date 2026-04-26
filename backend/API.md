# GridSync Backend API Documentation

This document provides information for the UI team on how to access and interact with the GridSync backend.

## Overview

The backend is built with **FastAPI**. By default, it runs with CORS enabled for `http://localhost:3000` and `http://127.0.0.1:3000`.

When the backend is running locally, you can view the interactive API documentation (Swagger UI) at:
- **Swagger UI:** `http://localhost:8000/docs` (Assuming default port 8000)
- **ReDoc:** `http://localhost:8000/redoc`

## Base URL
`http://localhost:8000` (or whichever port the FastAPI server is running on)

---

## Endpoints

### 1. Root
- **Method:** `GET`
- **Path:** `/`
- **Description:** Returns a welcome message and links to documentation and health endpoints.
- **Response:**
  ```json
  {
      "message": "GridSync FastAPI backend is running.",
      "docs": "/docs",
      "health": "/health"
  }
  ```

### 2. Health Check
- **Method:** `GET`
- **Path:** `/health`
- **Description:** Checks if the API is up and running.
- **Response:**
  ```json
  {
      "status": "ok",
      "service": "GridSync API",
      "version": "0.1.0"
  }
  ```

### 3. NERC Vector Search (RAG)
- **Method:** `POST`
- **Path:** `/nerc-vector-search`
- **Description:** Performs a hybrid (dense + sparse) search over the Qdrant collection.
- **Request Body (JSON):**
  ```json
  {
      "query": "Your search query here",
      "k": 5
  }
  ```
  - `query` (string, required): The search text.
  - `k` (integer, optional, default: 5): The number of chunks to return (1-50).
- **Response:**
  ```json
  {
      "query": "Your search query here",
      "chunks": [
          {
              "id": "chunk_id",
              "score": 0.95,
              "dense_score": 0.9,
              "sparse_score": 0.8,
              "rerank_score": 0.95,
              "text": "The matching text content...",
              "metadata": {
                  "source": "document.pdf",
                  "page": 1
              }
          }
      ]
  }
  ```

### 4. Chunk Graph Relationships
- **Method:** `GET`
- **Path:** `/graph/chunks/{file_id}/{chunk_num}/relationships`
- **Description:** Returns the `(from, rel, to)` triples adjacent to a single `DocumentChunk` node in the Neo4j knowledge graph. Useful for displaying which entities (Events, Locations, Utilities, etc.) a given chunk references.
- **Path Parameters:**
  - `file_id` (string, required): Value of the `file_id` property on the chunk node (typically a UUID).
  - `chunk_num` (string, required): Value of the `chunk_no` property on the chunk node, stored as a string (e.g. `"1"`).
- **Response:**
  ```json
  {
      "file_id": "abc-123",
      "chunk_num": "1",
      "relationships": [
          {
              "from_node": ["DocumentChunk"],
              "relationship": "MENTIONS",
              "to_node": ["Event"]
          }
      ]
  }
  ```
  Returns an empty `relationships` array if the chunk does not exist or has no incident edges.

### 5. Main Agent Chat
- **Method:** `POST`
- **Path:** `/agent/main`
- **Description:** Sends a message to the main LangChain agent (backed by Gemini) and returns the agent's reply along with any tool calls made.
- **Request Body (JSON):**
  ```json
  {
      "message": "Hello, agent!"
  }
  ```
  - `message` (string, required): User message to send to the main agent.
- **Response:**
  ```json
  {
      "reply": "Hello! How can I help you today?",
      "tool_calls": [
          {
              "name": "get_current_time",
              "args": {}
          }
      ]
  }
  ```

### 6. Main Agent Chat (SSE Stream)
- **Method:** `POST`
- **Path:** `/agent/main/stream`
- **Description:** Same as `/agent/main`, but streams the agent's response as **Server-Sent Events** (`text/event-stream`). Tokens stream live as the LLM emits them, and tool calls/results are surfaced as discrete events.
- **Request Body (JSON):** identical to `/agent/main`:
  ```json
  { "message": "What time is it?" }
  ```
- **Response:** `Content-Type: text/event-stream`. The stream emits the following named events; each event's `data:` payload is JSON.

  | Event         | Payload shape                              | Notes                                                     |
  | ------------- | ------------------------------------------ | --------------------------------------------------------- |
  | `token`       | `{ "text": "..." }`                        | One incremental LLM text delta. Concatenate to render.    |
  | `tool_call`   | `{ "name": "...", "args": { ... } }`       | Fired right before a tool runs.                           |
  | `tool_result` | `{ "name": "...", "output": "..." }`       | Fired after the tool returns. `output` is stringified.    |
  | `done`        | `{}`                                       | Final event. Server closes the stream after this.         |
  | `error`       | `{ "detail": "..." }`                      | Sent if the agent raised. Stream closes after.            |

  **Example wire output:**
  ```
  event: tool_call
  data: {"name": "get_current_time", "args": {}}

  event: tool_result
  data: {"name": "get_current_time", "output": "2026-04-26T18:34:00+00:00"}

  event: token
  data: {"text": "The current"}

  event: token
  data: {"text": " server time is"}

  event: token
  data: {"text": " 2026-04-26T18:34:00+00:00."}

  event: done
  data: {}
  ```

- **Browser example (`EventSource` is GET-only, so use `fetch` + a reader):**
  ```javascript
  const res = await fetch('http://localhost:8000/agent/main/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'What time is it?' }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE records are separated by a blank line.
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = raw.split('\n');
      const event = lines.find(l => l.startsWith('event: '))?.slice(7) ?? 'message';
      const data  = lines.find(l => l.startsWith('data: '))?.slice(6) ?? '';
      const payload = data ? JSON.parse(data) : {};

      if (event === 'token')       appendToReply(payload.text);
      else if (event === 'tool_call')   showToolCall(payload);
      else if (event === 'tool_result') showToolResult(payload);
      else if (event === 'done')        finalize();
      else if (event === 'error')       handleError(payload.detail);
    }
  }
  ```

- **`curl` smoke test:**
  ```bash
  curl -N -X POST http://localhost:8000/agent/main/stream \
    -H 'Content-Type: application/json' \
    -d '{"message":"What time is it?"}'
  ```
  (`-N` disables curl's output buffering so events print as they arrive.)

---

## Connecting from the UI (React/Next.js)

Assuming your UI is running on `http://localhost:3000`, you can make requests to the backend using `fetch` or `axios`. The backend is pre-configured to accept CORS requests from this origin.

**Example Fetch Request:**

```javascript
const searchNerc = async (query) => {
  const response = await fetch('http://localhost:8000/nerc-vector-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, k: 3 }),
  });
  
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  
  return await response.json();
};
```
