
# Saudi Arabic GPT-Live voice assistant

This project connects the existing `frontEnd_poc/` page to OpenAI GPT-Live (`gpt-live-1`) over WebRTC. The server keeps the OpenAI API key private and retrieves student facts from the existing `Data/BasicData.json`. No other ASR/LLM/TTS model is selected or substituted. Browser recording, browser ASR, and browser TTS are not used: microphone audio and generated speech travel through the real GPT-Live session.

## Billing and key setup

GPT-Live sessions are billable at **$0.05 per minute, billed by the second**; local dataset lookup is not an OpenAI request. Delegated tools can have separate charges if configured, but this app performs retrieval locally and does not call a Responses model. The UI displays the session rate and asks for confirmation before requesting a Live session. No session is opened on page load, health checks, or automated tests.

Copy `.env.example` to `.env` only if you do not already have a local `.env`, then set `OPENAI_API_KEY`. The backend also accepts the existing `API_KEY` variable. Never paste the key into frontend files or commit `.env`; it is ignored by Git. A key's validity and account access cannot be verified without a provider request.

## Install and run (Windows PowerShell)

From this project directory:

```powershell
py -3.12 -m venv .venv
Set-ExecutionPolicy -Scope Process Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env  # skip if .env already exists
notepad .env
```

Start backend in PowerShell window 1:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Start frontend in PowerShell window 2:

```powershell
Set-Location .\frontEnd_poc
$env:BACKEND_URL = "http://127.0.0.1:8000"
node .\server.mjs
```

Open `http://localhost:5173`, press **ابدأ محادثة صوتية**, review and accept the rate confirmation, then allow microphone access. Say a question; the page displays transcript fragments, data lookup stage, assistant response text, and remote audio playback. Press **إنهاء المحادثة** to close it.

Stop either server with **Ctrl+C** in its PowerShell window. To stop an orphaned development process, inspect first with `Get-NetTCPConnection -LocalPort 8000,5173 -State Listen`; then stop only the matching PID with `Stop-Process -Id <PID>`.

## Test and health check

```powershell
.\.venv\Scripts\Activate.ps1
python -m unittest discover -s tests -v
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/status
```

Tests read the real JSON dataset and mock the provider session-creation response. They make no network calls, start no Live sessions, and create no charges. A mocked API test only verifies payload construction; it does not verify account model access, actual microphone transport, transcription, or playback.

## Architecture and limitations

1. Browser obtains mic access only after the user confirms a paid Live session.
2. Browser creates an `RTCPeerConnection`, audio track and data channel; it posts the SDP offer to local `POST /api/live/session`.
3. FastAPI calls OpenAI's documented `POST /v1/live/sessions` with the exact `gpt-live-1` model. The API key never leaves the backend.
4. Live transcript/output events update the page. For client delegations, the browser sends the recognized utterance to local `POST /api/student/lookup`; the service reads the existing JSON and returns facts to GPT-Live using `session.commentary.append`.

Transcript fragments are incremental and may be incomplete; the Live protocol does not provide a transcript-done event for these events. The lookup uses accumulated available transcript text. No real GPT-Live session has been run during implementation because session minutes are billable and require explicit approval. Real voice pipeline functionality therefore remains unverified until an approved session is started in the browser.

## Endpoints

- `GET /api/health`: local backend liveness only.
- `GET /api/status`: selected model ID and whether the key variable is configured; no provider request.
- `POST /api/live/session`: creates a billable Live session after the UI's explicit confirmation.
- `POST /api/student/lookup`: retrieves only from `Data/BasicData.json`.
- `DELETE /api/live/session/{session_id}`: removes local session context.
