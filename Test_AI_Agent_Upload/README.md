# مساعد مدرستي الصوتي والنصي

تطبيق محلي يتيح اختيار طالب من مجموعة البيانات ثم السؤال عن ملفه، الحضور، الاختبارات، الدرجات، والإعلانات كتابةً أو بالصوت. مصدر البيانات هو `../supabase/data/madrasati-dataset.json`. كل محادثة مرتبطة بمعرّف الطالب الذي اختاره المستخدم؛ الخادم يتحقق من المعرّف ولا يبدل النطاق استناداً إلى نص السؤال.

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

The standalone conversation demo uses ../supabase/data/madrasati-dataset.json. Student records may include onlineLessons and assignments. Added examples are marked demo=true and source=synthetic_demo, not real observations. Percentages use score / outOf; subject averages require two assessments, trends require three dated results, and missing scores are excluded. Missing records do not prove absence, zero, or non-submission. Noor is only suggested as a parent follow-up; the application has no Noor integration.

Run tests from this directory: .venv\Scripts\python.exe -m unittest discover -s tests -v

## الديمو (ولي الأمر + لوحة التشغيل + المكالمات)

البيانات في Supabase (مصدر واحد): الموقع ولوحة `/demo-control` وجسر المكالمات يقرؤون منه. الـ Agent هنا يقرأ نفس ملف البيانات
المستورد (`../supabase/data/madrasati-dataset.json`، وتقدر تغيّره بـ `MADRASATI_DATASET`). التفاصيل والتشغيل الكامل في
`../docs/demo-control.md`. تشغيل سريع (الـ backend + ngrok + الموقع): `./run_demo.sh` (و`status` و`stop`).

## Integration boundary

The standalone browser conversation (`frontEnd_poc`, port 5173; `/api/student/chat` and browser Live lookup) reads the **import fixture**, not current Supabase rows. Editing a student in `/demo-control` does not update that file. Keep this separate from the integrated parent-notification demo; it is not a live view of school changes. These standalone routes have no parent authentication and are for fictional local testing only.

The integrated `/demo-control` preview and dispatch use Supabase and the signed, limited call context. Phone calls started there load the context using `backend/call_context.py`; they do not fall back to the fixture. Shared passwordless demo dispatch remains mock-only. A real delivery test has not been performed as part of this merge.

`run_demo.sh` stops only matching processes tracked in its `.demo` directory. It refuses to start if ports 3000 or 8000 are already occupied by other servers; it never kills servers by port or process name globally. Launch scripts are optional; existing manual start commands remain supported.
