# Website → Tammeni preference preview

This first integration step connects the existing saved-preferences confirmation page to the Python backend. It does not send SMS, create voice sessions, schedule deliveries, or change Supabase.

## Run locally

Start the Python backend from `Test_AI_Agent_Upload` using an environment with its `requirements.txt` installed:

```sh
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

Start the website from the repository root with `npm run dev`. The website server defaults to `http://127.0.0.1:8000`; override that with the server-only `TAMMENI_BACKEND_URL` in `.env.local` if needed. No Twilio or OpenAI keys are needed for previews.

Sign into the existing fictional demo, select Reem or Nawaf, save preferences, and choose **معاينة حسب تفضيلاتي** on the confirmation page. The Python backend must be running; otherwise an Arabic connection error appears.

## Data flow and limits

- The browser posts the selected student ID to `POST /api/assistant/preview`.
- The Next.js server reads the student, the records and the **saved** preferences from Supabase with the signed-in parent's session (RLS: only that parent's children). It ignores anything else the browser sends. (Updated 2026-10-29; see `docs/demo-control.md`.)
- It sends that record and the preferences to `POST /api/parent/preview` on the Python backend.
- The backend validates preference values, excludes disabled topics, and returns separate previews with each topic's selected contact method and schedule. It does not combine different schedules into one contact.
- The preview displays the available fictional records; it is not a due-now scheduling calculation or the previous-month grades report. The existing generic `message` choice is not yet bound to an SMS provider.
- Switching students or saved preferences clears the previous preview.
- The parent is a real (shared, fictional) Supabase Auth account; access is enforced by RLS. The records are fictional.
- The existing phone bridge and its Muhammad JSON dataset remain unchanged. No preview is fed into a real call yet.

## Verification

Run `python -m unittest discover -s tests -v` inside `Test_AI_Agent_Upload`. Preview tests cover topic exclusion, contact methods, changing students, invalid preferences and IDs, and requests that do not call an external provider.
