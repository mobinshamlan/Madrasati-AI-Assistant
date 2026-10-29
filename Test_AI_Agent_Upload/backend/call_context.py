"""
طمّني — سياق التحديث (المكالمة أو الرسالة) من Supabase.

الموقع (لوحة الديمو) يحفظ لكل محاولة إرسال سياقًا محدودًا خلف رمز عشوائي قصير العمر، ويخزّن
قاعدة البيانات تجزئة الرمز فقط. هنا نسترجع السياق بالرمز عبر الدالة public.get_call_context،
فلا نعتمد على اسم طالب أو درجة تأتي من المتصفح أو من رابط Twilio.

السياق يحمل حقائق هذا التحديث وحده (موضوع واحد)؛ الموضوعات المقفلة لا تُمرَّر للـAI أصلًا.
لا بديل احتياطي: إذا تعذّر تحميل السياق لا نستخدم بيانات محمد القديمة.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

TOPIC_NAMES = {"attendance": "الحضور والغياب", "exams": "الاختبارات", "grades": "الدرجات"}


def _supabase() -> tuple[str, str] | None:
    url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or ""
    if not url or not key or key.startswith("sb_secret_"):
        return None
    return url, key


def valid_context(ctx: Any) -> bool:
    if not isinstance(ctx, dict) or ctx.get("version") != 1:
        return False
    topic = ctx.get("topic")
    return (
        topic in TOPIC_NAMES
        and ctx.get("allowed_topics") == [topic]
        and ctx.get("method") in ("call", "message")
        and ctx.get("persona") in ("lulwa", "turki")
        and isinstance(ctx.get("facts"), list)
        and all(isinstance(f, str) for f in ctx["facts"])
        and isinstance(ctx.get("message"), str)
        and isinstance(ctx.get("opening"), str)
        and isinstance(ctx.get("student"), dict)
    )


async def load_context(token: str | None) -> dict[str, Any] | None:
    """The context for a valid, unexpired token, or None. Never raises to the caller."""
    if not token or not (32 <= len(token) <= 200):
        return None
    conf = _supabase()
    if conf is None:
        return None
    url, key = conf
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{url}/rest/v1/rpc/get_call_context",
                headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"p_token": token},
            )
    except httpx.HTTPError:
        return None
    if response.status_code != 200:
        return None
    try:
        ctx = response.json()
    except ValueError:
        return None
    return ctx if valid_context(ctx) else None


def context_instructions(ctx: dict[str, Any]) -> str:
    """GPT-Live instructions built only from this update's facts."""
    persona = ctx["persona"]
    name = "لولوة" if persona == "lulwa" else "تركي"
    close = "يومك سعيد" if persona == "lulwa" else "يعطيك العافية"
    first_name = str(ctx["student"].get("first_name", ""))
    facts = "\n".join(f"- {f}" for f in ctx["facts"])
    topic = TOPIC_NAMES[ctx["topic"]]
    return f"""أنت {name} من خدمة «طمّني»، مساعد صوتي يتصل بولي أمر الطالب {first_name} بخصوص موضوع واحد: {topic}.
تتكلم باللهجة السعودية الطبيعية، بجمل قصيرة ونبرة ودودة. هذي مكالمة هاتفية.

افتح المكالمة بهذي الجملة حرفيا (بعد ما يرد ولي الأمر):
«{ctx["opening"]}»

الحقائق الموثقة الوحيدة المسموح لك بذكرها في هذه المكالمة:
{facts}

ضوابط المكالمة:
- لا تذكر أي معلومة غير الحقائق أعلاه. إذا سُئلت عن درجات أو حضور أو اختبارات أخرى قل: «ما عندي تفاصيل أكثر حاليا، تقدر تطلع عليها من حسابك أو المدرسة تفيدك».
- لا تؤكد أنك رفعت عذر أو أبلغت المدرسة أو جدولت تذكيرا أو نفذت أي إجراء. أنت تبلغ فقط.
- إذا قال إن الطالب مريض أو عنده عذر: ادعُ له بالسلامة، وقل إن رفع العذر يكون من ولي الأمر عبر القناة المعتمدة لدى المدرسة.
- إذا قال إن الرقم غلط أو إنه مو ولي أمر الطالب: اعتذر عن الإزعاج، ولا تذكر أي بيانات عن الطالب، وأنهِ المكالمة.
- إذا كلامه غير واضح: «عفوا، ما وضح لي ردك، ممكن تعيده باختصار؟». وإذا استمر بعد المحاولة الثانية: «نأمل تتواصل مع المدرسة بخصوص التنبيه. شكرا لك.» وأنهِ المكالمة.
- إذا قاطعك ولي الأمر، وقّف كلامك واسمعه.
- مدة المكالمة قصيرة: موضوع واحد وسؤال توضيحي واحد كحد أقصى.
- ودّع بجملة واحدة تنتهي بـ«{close}» وما تفتح موضوع جديد.
- لا تخترع درجات أو تواريخ أو حضور."""
