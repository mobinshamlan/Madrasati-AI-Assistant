# Madrasati-AI-Assistant
## 📄 Project Documentation

Explore the full project report and final presentation for more details about the project, its features, implementation, and results.

- 📑 [View Final Project Report](<طمني_Report_Final22222 (1).pdf>)
- 📊 [View Final Presentation](<(1) طمني عرض النهائي.pptx>)
- عقم
- - 📑 [URL طمني](https://tammeni-demo.vercel.app/)

- URL : https://tammeni-demo.vercel.app/


Educational Arabic RTL prototype inspired by Madrasati (منصة مدرستي). Fictional student records only. Not affiliated with the official Madrasati platform.

## Local development (website)

Requires Node.js 20.9 or newer.

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill the empty variables (see below). Never commit `.env.local`.
3. `npm run dev` → http://localhost:3000
4. Optional production check: `npm run build` && `npm start`

Checks: `npm run lint`, `npm test`, `npm run build`. Typecheck: `npx tsc --noEmit`.

## Environment (teammate setup)

Website (`.env.local` from `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — project **Connect** dialog; publishable key only
- `TAMMENI_BACKEND_URL` — defaults to `http://127.0.0.1:8000`
- `TAMMENI_DEMO_PARENT_*` / `TAMMENI_DEMO_OPERATOR_*` — fictional demo Auth accounts (server-only; ask the team lead for values, never put them in docs or git)
- `TAMMENI_LOCAL_OPERATOR` — leave empty unless you want local auto-open of `/demo-control` under `npm run dev` on this machine only
- `TAMMENI_SHARED_DEMO` — set to `1` so teammates open `/demo-control` without a password on the shared URL too. Those automatic sends stay mock-only. Leave empty for the password form and the separate real-dispatch path
- `TAMMENI_DISPATCH_SECRET` — shared with the Python backend; long and random

Python backend (`Test_AI_Agent_Upload/.env` from that folder’s `.env.example`):

- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TAMMENI_DISPATCH_SECRET` (same secret as the website)
- `TAMMENI_PROVIDER` defaults to **`mock`** (nothing is sent). Do not set `twilio` unless a person has approved a real test.

Never use a Supabase secret/service-role key in these files.

## Database migrations (without repeating)

Migration files live in `supabase/migrations/` with versioned names. On a shared Supabase project, apply **only versions that are not already recorded** in the project’s migration history (Dashboard → Database → Migrations, or `supabase db push` / linked CLI). Re-applying an already-recorded version is unnecessary and should be skipped.

Demo school data import is separate and repeatable: see `docs/demo-control.md` (`scripts/build-demo-import.mjs` → `supabase/seed/demo-dataset-import.sql`). Stable keys mean a re-run does not wipe the project; it does not replace migration application.

Structure and RLS notes: `docs/database.md`. Demo roles, control panel, and limits: `docs/demo-control.md`. Preference preview: `docs/backend-preview.md`.

## Opening the demo

1. Start the Python backend from `Test_AI_Agent_Upload` (venv + `uvicorn` on port 8000) — see `docs/demo-control.md`.
2. Start the website (`npm run dev`).
3. Parent path: open `/welcome` (localhost or the shared URL), then «ابدأ مع طمّني». No password.
4. Operator / demo control: open `/demo-control`. It opens directly when `TAMMENI_SHARED_DEMO=1` or local operator mode is on; otherwise sign in with the operator password.

Automatic background scheduling and unanswered-call retry workers are **not** implemented. Manual «تشغيل التحديث الآن — للديمو» with the **mock** provider records a log entry and does not send SMS or place calls.

## Safety

- Use fictional data only. Never commit secrets, real student records, or real phone numbers.
- `.env*` is gitignored except empty `.env.example` templates.
