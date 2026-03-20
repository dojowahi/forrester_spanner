---
name: ADK Agent Integration and Deployment
description: Best practices and gotchas for building, integrating (React), and deploying Google ADK Agents to Cloud Run.
---

# Google ADK Agent Integration Guidelines

This skill outlines the necessary patterns for integrating Google ADK Python agents with custom frontends and successfully deploying them to Google Cloud Run, particularly when working with Data Agents.

## 1. Local Development & CORS
By default, the `adk web` command is useful for quick testing but doesn't easily support cross-origin requests (CORS) from a separate frontend development server.

**Pattern:** Create a custom `main.py` using FastAPI.

```python
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from google.adk.cli.fast_api import get_fast_api_app

app = get_fast_api_app(agent_dir=".", session_service_uri=None)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Change to specific origins in prod, e.g., ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

## 2. API Interaction from Frontend
To interact with the ADK agent REST API, you must handle sessions and run executions explicitly.

### Session Initialization
The frontend must first create a session before sending messages.
- **Endpoint:** `POST /apps/{app_name}/users/{user_id}/sessions`
- **Note:** Do not rely on passing an ID in the payload. Capture the dynamically generated `id` returned in the JSON response.

### Sending Messages
Use the `/run` endpoint to interact.
- **Endpoint:** `POST /run`
- **Payload Structure:**
```json
{
  "appName": "your_app_name",
  "userId": "your_user_id",
  "sessionId": "the_captured_session_id",
  "newMessage": {
    "role": "user",
    "parts": [{"text": "User's message here"}]
  }
}
```

### Parsing Responses
The `/run` endpoint returns an array of events detailing the agent's thought process and actions. 
- **Gotcha:** Do not hardcode a check for `author === 'agent'`. ADK dynamically returns the actual agent name (e.g., `root_agent`). Filter for non-user messages: `event.author && event.author !== 'user'`.

## 3. Cloud Run Deployment & Data Agent Credentials
Deploying ADK agents, specifically those using **Data Agents**, to Cloud Run requires explicit credential handling.

Cloud Run uses Compute Engine default credentials, which are "lazy-loaded" and start without a valid `.token` populated. ADK's `DataAgentCredentialsConfig` strictly validates the presence of an access token and will fail with a `ValueError` if this is not addressed.

**Required Fix in Agent Initialization (`agent.py`):**
Before instantiating the tool/agent, explicitly request the `cloud-platform` scope and refresh the credentials synchronously to pre-populate the `.token`.

```python
import google.auth
import google.auth.transport.requests
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig

# 1. Request explicit scope
application_default_credentials, project_id = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)

# 2. Explicitly refresh to populate the .token attribute synchronously
application_default_credentials.refresh(google.auth.transport.requests.Request())

# 3. Pass to Data Agent config
credentials_config = DataAgentCredentialsConfig(
    credentials=application_default_credentials
)
```

## 4. Frontend Dynamic Routing
When deploying the frontend, ensure it routes to the correct backend URI dynamically depending on the environment, otherwise the deployed frontend will attempt to call the user's `localhost`.

```javascript
// Using window.location.hostname to switch environments
const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
  ? 'http://127.0.0.1:8080' 
  : 'https://<your-cloud-run-url>.run.app';
```
