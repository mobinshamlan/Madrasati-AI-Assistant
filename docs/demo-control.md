# Tammeni demo: Supabase data, demo control and dispatch

Everything here is fictional demo data. The website, the demo control page and the Python backend read
the same Supabase records; nothing falls back to the bundled copies when Supabase is unreachable.

## Data source

| What | Where |
| --- | --- |
| Team dataset (raw, unchanged) | `supabase/data/madrasati-dataset.json` → table `demo_source_records` |
| Website model | `students`, `attendance_terms`, `attendance_records`, `exams`, `grades`, `announcements`, `online_lessons`, `assignments` |
| Parent's choices | `assistant_preferences` (one row per parent and child) |
| Simulated events | `demo_events` (+ the school row each one writes, marked `origin = 'demo'`) |
| Decisions and sends | `notifications`, `dispatch_attempts`, `call_contexts` (token hash only) |

- **Import:** `node scripts/build-demo-import.mjs > supabase/seed/demo-dataset-import.sql`, then run the output as an
  administrator. Stable source keys make it repeatable; nothing is deleted. Real dates come from the Hijri
  (Umm al-Qura) dates; the original display text is kept beside them and checked.
- **School-day attendance and online lessons:** stored separately. Online lessons and assignments are kept, but
  produce no updates yet.
- **Demo parent:** linked to ريم and نواف only. فيصل and لجين stay in the data but are linked to no account. Their
  older browser-only preferences (from the earlier localStorage version) are left untouched on the device that
  saved them.
- **Older browser preferences:** for ريم or نواف, the assistant page offers to load them into the review. They are
  saved to the account only when the parent presses «حفظ التفضيلات», and are never deleted from the browser.

## Roles

Both roles are real Supabase Auth users. The browser never decides a role.

- **Parent** — `demo-parent@tammeni-demo.example`
  - The server signs this account in when a visitor presses «ابدأ مع طمّني» or «دخول». The password stays on the
    server.
  - RLS lets it read only ريم and نواف and save only their preferences.
  - Every visitor to the demo becomes this same fictional parent, by design.
- **Operator** — `demo-operator@tammeni-demo.example`, holding `app_metadata.tammeni_role = 'demo_operator'`
  - Only an administrator can set that role.
  - The operator signs in on `/demo-control` with a password, and the session uses its own cookie
    (`tammeni-operator`), so it never mixes with the parent's.
  - **Local mode (optional, off by default):** with `TAMMENI_LOCAL_OPERATOR=1` in `.env.local` and `npm run dev`,
    `/demo-control` opens without the form. The server signs the same operator account in (from
    `TAMMENI_DEMO_OPERATOR_*`), into the same operator cookie. It refuses unless the request came straight from
    this machine: `Host`, `X-Forwarded-Host` and `X-Forwarded-For` loopback, plain http, a same-origin sign-in.
    Through ngrok, the local network, `next start` or a deploy, the normal form and 401/403 apply. See
    `src/lib/tammeni/local-operator.ts`.
  - **Shared demo (optional, off by default):** with `TAMMENI_SHARED_DEMO=1`, `/demo-control` opens the same way
    on localhost **and** on the shared URL (ngrok or another host). The POST must come from a page on that same
    host. The password stays on the server. Sends from that automatic session are **mock only**: the website
    records a mock attempt and does not call the provider. Signing in with the operator password clears that
    marker and uses `TAMMENI_PROVIDER` on the Python backend again (still mock unless someone set `twilio`).
    See `src/lib/tammeni/shared-demo.ts`. Restart `npm run dev` after changing the variable.
  - It records events for demo students and runs the demo. It cannot read the raw source, delete rows, or edit
    imported records (only an imported exam's cancelled/scheduled status).
- **Where the passwords are:** `.env.local` (git-ignored), as `TAMMENI_DEMO_*`. Check the roles against the
  real project with `node --env-file=.env.local scripts/verify-supabase-roles.mjs`.

## Running it

1. **Python backend** (from `Test_AI_Agent_Upload`):
   ```sh
   .venv/bin/uvicorn backend.app:app --port 8000
   ```
   Its `.env` must carry `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `TAMMENI_DISPATCH_SECRET` (the same value as
   the website's). `TAMMENI_PROVIDER` defaults to `mock`.
2. **Website:** `npm run build && npm start`, or `npm run dev`.
3. **Parent side:** open `/welcome` on localhost or the shared URL, then «ابدأ مع طمّني». No email or password.
   The server signs in the fictional parent. That session is not the operator session.
   1. Choose ريم.
   2. Open «إعداد المساعد الذكي».
   3. Save choices. For example, attendance «مباشرة» by message, grades monthly on day 5.
   4. Do the same for نواف, for example attendance «إيقاف».
4. **Operator side:** open `/demo-control`. With `TAMMENI_SHARED_DEMO=1` or local mode it opens directly; otherwise sign in with the operator password.
   1. Choose ريم.
   2. Record an absence, then «حفظ الحدث». You see the decision and its reason.
   3. Open the event card, then «معاينة التحديث». You see the exact message, or لولوة's first sentence on a call.
   4. Press «تشغيل التحديث الآن — للديمو». With the mock provider nothing is sent; the log says so.
   5. Try نواف's absence: it is suppressed, and «تشغيل الآن» is not offered (the server refuses it too).
   6. Add an exam three days ahead: it waits for the reminder time. «تشغيل الآن» records the original time.
   7. Publish a grade with monthly grades: it waits for day D of next month. The preview covers that month only.
   8. Accept an excuse for a simulated absence: its unsent update is cancelled.
5. **Resets** live in the red box at the bottom of the student's panel:
   - «إعادة ضبط تفضيلات …» resets that child's preferences only.
   - «مسح أحداث المحاكاة …» archives that child's simulated events, cancels their unsent updates, and restores
     imported exams the demo cancelled. Sent attempts stay in the log.

## Timing: what exists and what does not

- **Evaluating a due time:** done. `src/lib/tammeni/evaluate.ts` is the single rule set, in Asia/Riyadh (UTC+3,
  no daylight saving).
- **Running an update by hand for the demo:** done.
  - It skips only the wait.
  - It never overrides a topic that is off or a cancelled update.
  - It re-checks the latest saved preferences; a change since the preview forces a new preview.
- **Automatic background scheduling:** **not implemented.** Nothing is sent when a due time arrives.
- **Retry of an unanswered call after 5 minutes:** stored as the parent's choice and carried in the call context.
  **It is not implemented** (no worker), and the pages say so.
- **Combining same-time updates:** not implemented; each event is evaluated and sent on its own.

## Sending for real (needs a person to set up and approve)

The mock provider is the default. Before the first real SMS or call:

1. In `Test_AI_Agent_Upload/.env`, set:
   - `TAMMENI_PROVIDER=twilio`
   - `PARENT_PHONE_CALL` (receives calls) and `PARENT_PHONE_SMS` (receives messages); each falls back to `PARENT_PHONE`
   - `TAMMENI_ALLOWED_DESTINATIONS` (comma-separated; must contain every number used)
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`
   - for calls: `PUBLIC_URL` (the ngrok address)
2. **Saudi numbers:** `TWILIO_SMS_FROM` defaults to the alphanumeric sender `Tammeni`, which was proven on a UK
   number. Saudi delivery is not proven.
3. **The destination** is always the server's test number. The browser cannot pick one, and the masked phone in
   the dataset is never used.
4. **Calls:**
   - `/api/phone/voice?ctx=<token>` checks Twilio's signature, then streams only the token.
   - The bridge loads that one update's facts from Supabase.
   - If the context cannot be loaded, it hangs up; there is no fallback to the old Muhammad data.
   - The old query-parameter path used by `make_call.py` is unchanged.
5. **Status:**
   - «قُبل لدى المزود» means Twilio accepted the request.
   - «تم التسليم» appears only after «تحديث الحالة من المزود» returns `delivered` (SMS) or `completed` (call).

## Known limits

- **The parent account is shared by all demo visitors.** Any of them could change its password through the Supabase
  Auth API. If the demo stops signing in, reset that password and `.env.local` together.
- **Supabase security advisor:**
  - "Leaked password protection" is off. Turning it on is an Auth setting in the dashboard.
  - `get_call_context` is callable with the publishable key on purpose. It returns only for an unguessable token
    that has not expired (one hour).
