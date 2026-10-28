
# GPT-Live voice frontend

This static page uses browser `RTCPeerConnection` for microphone and returned audio plus a data channel for transcript and local student lookup events. It does not use `MediaRecorder`, browser speech recognition, or browser speech synthesis.

Run the FastAPI backend at `127.0.0.1:8000`, then run this folder with Node 18+:

```powershell
$env:BACKEND_URL = "http://127.0.0.1:8000"
node .\server.mjs
```

Open `http://localhost:5173`. A browser confirmation explains the GPT-Live rate and is required before the app requests a session. See the repository root README for setup, cost information, and API details.
