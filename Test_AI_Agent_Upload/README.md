# مساعد مدرستي الصوتي والنصي

تطبيق محلي يتيح اختيار طالب من مجموعة البيانات ثم السؤال عن ملفه، الحضور، الاختبارات، الدرجات، والإعلانات كتابةً أو بالصوت. مصدر البيانات هو `Data/madrasati-dataset.json`. كل محادثة مرتبطة بمعرّف الطالب الذي اختاره المستخدم؛ الخادم يتحقق من المعرّف ولا يبدل النطاق استناداً إلى نص السؤال.

## المتطلبات
- Python 3.12
- Node.js 18 أو أحدث
- مفتاح OpenAI لتوليد إجابات النص والصوت المباشر (الإجابات النصية تستخدم سجلات محلية عند غياب المفتاح أو تعطل المزود)

## التشغيل على Windows PowerShell

من مجلد `Test_AI_Agent`:

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

من مجلد `Test_AI_Agent`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
Invoke-RestMethod http://127.0.0.1:8000/api/health
```

الحسابات للنسبة تخص التقييم الفردي فقط عند توفر الدرجة والدرجة القصوى، ولا تمثل معدلاً عاماً. الخدمة نموذج أولي محلي ولا تطبق تسجيل دخول أو صلاحيات إنتاجية.


## Structured student insights and demo records

The backend uses Data/madrasati-dataset.json. Student records may include onlineLessons and assignments. Added examples are marked demo=true and source=synthetic_demo, not real observations. Percentages use score / outOf; subject averages require two assessments, trends require three dated results, and missing scores are excluded. Missing records do not prove absence, zero, or non-submission. Noor is only suggested as a parent follow-up; the application has no Noor integration.

Run tests from this directory: .venv\Scripts\python.exe -m unittest discover -s tests -v

## نظام ولي الأمر والمدرسة والمكالمات (الديمو)

مصدر الحقيقة الوحيد للبيانات هو `Data/madrasati-dataset.json` (البذرة)، وأول تشغيل ينسخه إلى `Data/runtime_state.json`
(البيانات الحية + تفضيلات ولي الأمر + سجل الأحداث). كل شي يمر عبر `backend/store.py`: صفحة ولي الأمر (`/`، `/assistant`)،
صفحة المدرسة (`/school`)، الـ Agent النصي والصوتي، وجسر المكالمات. حذف `runtime_state.json` يرجّع البيانات للبذرة.

- تسجيل غياب أو درجة أو اختبار من `/school` يعدّل نفس البيانات اللي تقرؤها صفحة ولي الأمر والـ Agent.
- بعدها `backend/notifier.py` يقرأ تفضيل ولي الأمر ويقرر: اتصال (Twilio + لولوة/تركي) أو رسالة أو لا شي.
- التشغيل الكامل (الـ backend + ngrok + الموقع): `./run_demo.sh` (و`status` و`stop`). يحتاج `.env` فيه مفاتيح Twilio وOpenAI و`PARENT_PHONE`.
- التجربة بدون اتصال فعلي: `DEMO_DRY_RUN=1`.
- بعد تعديل `madrasati-dataset.json`: `node scripts/generate-supabase-seed.mjs` (من جذر المشروع) لتحديث `supabase/seed.sql`.
