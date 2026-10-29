# مساعد مدرستي الصوتي والنصي

تطبيق محلي يتيح اختيار طالب من مجموعة البيانات ثم السؤال عن ملفه، الحضور، الاختبارات، الدرجات، والإعلانات كتابةً أو بالصوت. السجلات المتغيرة تُقرأ من Supabase بصلاحيات ولي الأمر، والمعلومات التعريفية من `../supabase/data/madrasati-dataset.json`. كل محادثة مرتبطة بمعرّف الطالب الذي اختاره المستخدم؛ الخادم يتحقق من المعرّف ولا يبدل النطاق استناداً إلى نص السؤال.

## المتطلبات
- Python 3.12
- Node.js 18 أو أحدث
- مفتاح OpenAI لتوليد إجابات النص والصوت المباشر (الإجابات النصية تستخدم سجلات محلية عند غياب المفتاح أو تعطل المزود)

## التشغيل على Windows PowerShell

من مجلد `Test_AI_Agent_Upload`:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# أنشئي .env من .env.example عند عدم وجوده، ثم أضيفي OPENAI_API_KEY
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

في نافذة ثانية:

```powershell
Set-Location .\frontEnd_poc
$env:BACKEND_URL = "http://127.0.0.1:8000"
node .\server.mjs
```

افتحي http://localhost:5173 ثم اختاري الطالب. الأسئلة النصية تستخدم سجلات الطالب المختار. بدء الصوت يطلب موافقة منفصلة، وقد يترتب عليه رسوم مزود الخدمة. لا تضعي المفتاح في ملفات الواجهة أو Git، ولا تشاركي ملف `.env`.

## الفحوصات

من مجلد `Test_AI_Agent_Upload`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

الحسابات للنسبة تخص التقييم الفردي فقط عند توفر الدرجة والدرجة القصوى، ولا تمثل معدلاً عاماً. الخدمة نموذج أولي محلي ولا تطبق تسجيل دخول أو صلاحيات إنتاجية.


## Structured student insights and demo records

The imported fixture is ../supabase/data/madrasati-dataset.json; the running agent reads live school records from Supabase. Student records may include onlineLessons and assignments. Added examples are marked demo=true and source=synthetic_demo, not real observations. Percentages use score / outOf; subject averages require two assessments, trends require three dated results, and missing scores are excluded. Missing records do not prove absence, zero, or non-submission. Noor is only suggested as a parent follow-up; the application has no Noor integration.

Run tests from this directory: .venv\Scripts\python.exe -m unittest discover -s tests -v

## الديمو (ولي الأمر + لوحة التشغيل + المكالمات)

البيانات في Supabase (مصدر واحد): الموقع ولوحة `/demo-control` وجسر المكالمات يقرؤون منه. الـ Agent هنا يقرأ نفس ملف البيانات
المستورد (`../supabase/data/madrasati-dataset.json`، وتقدر تغيّره بـ `MADRASATI_DATASET`). التفاصيل والتشغيل الكامل في
`../docs/demo-control.md`. تشغيل سريع (الـ backend + ngrok + الموقع): `./run_demo.sh` (و`status` و`stop`).

## Live data flow after integration

- Parent preferences select the student, topic and communication method. Demo-control rechecks preferences before dispatch and blocks disabled topics.
- The signed call context contains the selected student's stable key and the event-specific facts from Supabase. Those facts drive the opening and answers about the update.
- The backend dataset supplies only matching static profile details (school, grade and classroom). It never supplies an old attendance/grade/exam record as a fallback for the current event. No match means no extra profile, not a different student.
- The standalone text and browser voice assistant now read current school records from Supabase on each request. Every request has its own dataset snapshot so repeated lookups within an answer use the same loaded records; the next question reloads them. Reads across tables are not a single database transaction.
- Reads sign in with the configured demo **parent**, use its publishable key and bearer token, and remain subject to RLS. Only linked students are available (Reem and Nawaf in the current demo). This is a shared fictional-parent demo, not individual visitor authentication.
- Disabled attendance/exam/grade categories are removed before reaching the assistant. No saved preferences means these categories are unavailable. The browser UI may still show generic category labels.
- Attendance is ordered by the school date, with active demo records overriding imported records for the same day. Archived records are excluded. Grades use publication date with creation time as a tie-breaker; exam cancellation remains explicit.
- Previous assistant answers are not sent as factual history to the text model. Current school facts come from the new database snapshot.
- A database failure produces an unavailable error; there is no fallback to stale JSON school records.

### Backend settings

Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `TAMMENI_DEMO_PARENT_EMAIL`, and `TAMMENI_DEMO_PARENT_PASSWORD` in the backend environment. On a local checkout the existing website `.env.local` provides these server-side settings as a fallback; values are never sent to the browser. Never use the operator or a service-role account for agent reads.

Restart the Python backend after updating code. Existing frontend URLs and request contracts are unchanged. Fixture-only behavior is available in Python tests by explicitly constructing `StudentDataService(DATA_PATH)`; the running app defaults to Supabase.

Shared passwordless demo dispatch remains mock-only. Real SMS/call delivery and paid model output were not exercised during this integration. Read-only live Supabase loading was verified; event changes between questions were verified with mocked snapshots, without modifying shared demo data.

`run_demo.sh` only stops matching processes tracked in its `.demo` directory, and refuses to start if other servers occupy ports 3000 or 8000.
