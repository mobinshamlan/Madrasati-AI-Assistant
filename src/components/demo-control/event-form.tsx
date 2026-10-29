"use client";

import { useState } from "react";
import { arabicDay, arabicTime } from "@/lib/tammeni/evaluate";
import type { Panel } from "./student-panel";
import { api, ErrorNote, fieldClass, labelClass, MethodLabel, newKey, primaryButton, StatusBadge } from "./shared";

type Kind = "attendance" | "grade_published" | "exam_added" | "exam_cancelled" | "excuse_accepted";
const kinds: { value: Kind; label: string }[] = [
  { value: "attendance", label: "حضور وغياب" },
  { value: "grade_published", label: "نشر درجة" },
  { value: "exam_added", label: "اختبار جديد" },
  { value: "exam_cancelled", label: "إلغاء اختبار" },
  { value: "excuse_accepted", label: "قبول عذر" },
];
const statusOptions = [
  { value: "absent", label: "غياب" },
  { value: "late", label: "تأخر" },
  { value: "present", label: "حضور" },
  { value: "excused", label: "غياب بعذر" },
];

type Result = {
  duplicate: boolean;
  event: { summary: string };
  notification: { status: string; method: string | null; reason: string; dueLabel: string | null } | null;
  excuse?: { outcome: "cancelled" | "already-sent" | "none"; status?: string };
};

export function EventForm({ panel, today, onSaved }: { panel: Panel; today: string; onSaved: () => void }) {
  const name = panel.student.firstName;
  const [kind, setKind] = useState<Kind>("attendance");
  const [f, setF] = useState({
    date: today,
    status: "absent",
    subject: "",
    assessment: "",
    score: "",
    outOf: "10",
    examDate: today,
    startTime: "",
    examKind: "اختبار قصير",
    examId: "",
    attendanceEventId: "",
  });
  // One key per submit intent; it changes only after a save succeeds, so a retry or double click is one event.
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const summary = (() => {
    if (kind === "attendance") return `${statusOptions.find((s) => s.value === f.status)?.label} يوم ${f.date ? arabicDay(f.date) : "—"}`;
    if (kind === "grade_published") return `درجة ${f.subject || "—"}: ${f.assessment || "—"} (${f.score || "—"} من ${f.outOf || "—"})، تاريخ النشر ${f.date ? arabicDay(f.date) : "—"}`;
    if (kind === "exam_added") return `اختبار ${f.subject || "—"} (${f.examKind || "—"}) يوم ${f.examDate ? arabicDay(f.examDate) : "—"}${f.startTime ? `، ${arabicTime(f.startTime)}` : ""}`;
    if (kind === "exam_cancelled") return `إلغاء: ${panel.examsToCancel.find((e) => e.id === f.examId)?.label ?? "اختر الاختبار"}`;
    return `قبول عذر: ${panel.absencesToExcuse.find((a) => a.eventId === f.attendanceEventId)?.label ?? "اختر الغياب"}`;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    const event: Record<string, unknown> = { kind, date: f.date };
    if (kind === "attendance") event.status = f.status;
    if (kind === "grade_published") Object.assign(event, { subject: f.subject, assessment: f.assessment, score: f.score, outOf: f.outOf });
    if (kind === "exam_added") Object.assign(event, { subject: f.subject, examKind: f.examKind, examDate: f.examDate, startTime: f.startTime || null });
    if (kind === "exam_cancelled") event.examId = f.examId;
    if (kind === "excuse_accepted") event.attendanceEventId = f.attendanceEventId;
    const r = await api<Result>(`/api/demo-control/students/${panel.student.id}/events`, { method: "POST", body: { event, idempotencyKey: key } });
    setBusy(false);
    if (!r.ok) return setError(r.error); // inputs stay as typed
    setResult(r.data);
    setKey(newKey());
    onSaved();
  };

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {input}
      {hint && <p className="mt-1 text-base text-ink">{hint}</p>}
    </div>
  );

  return (
    <section aria-labelledby="event-title" className="rounded-xl border border-line bg-white p-5">
      <h3 id="event-title" className="text-xl font-bold text-ink">
        تسجيل حدث لـ{name}
      </h3>
      <p className="mt-1 text-base text-ink">«حفظ الحدث» يسجله ويقيّمه فقط. لا يتصل بأحد ولا يرسل شيئًا.</p>

      <fieldset className="mt-4">
        <legend className="sr-only">نوع الحدث</legend>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <label
              key={k.value}
              className={`inline-flex min-h-12 cursor-pointer items-center rounded-full border-2 px-4 font-bold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tile-navy ${
                kind === k.value ? "border-brand-600 bg-brand-600 text-white" : "border-[#9da4ae] bg-white text-ink hover:border-brand-500"
              }`}
            >
              <input type="radio" name="event-kind" value={k.value} checked={kind === k.value} onChange={() => { setKind(k.value); setResult(null); setError(""); }} className="sr-only" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {field("ev-date", kind === "grade_published" ? "تاريخ النشر" : "تاريخ الحدث (يوم دراسي)", <input id="ev-date" type="date" value={f.date} onChange={set("date")} className={fieldClass} required />)}
          {kind === "attendance" &&
            field("ev-status", "الحالة", (
              <select id="ev-status" value={f.status} onChange={set("status")} className={fieldClass}>
                {statusOptions.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            ), "حضور اليوم المدرسي (وليس حصة إلكترونية).")}
          {(kind === "grade_published" || kind === "exam_added") &&
            field("ev-subject", "المادة", <input id="ev-subject" value={f.subject} onChange={set("subject")} className={fieldClass} maxLength={80} required />)}
          {kind === "grade_published" && (
            <>
              {field("ev-assessment", "اسم التقييم", <input id="ev-assessment" value={f.assessment} onChange={set("assessment")} className={fieldClass} maxLength={120} required />)}
              {field("ev-score", "الدرجة", <input id="ev-score" type="number" inputMode="decimal" min="0" step="0.25" value={f.score} onChange={set("score")} className={fieldClass} required />)}
              {field("ev-outof", "الدرجة الكاملة", <input id="ev-outof" type="number" inputMode="decimal" min="0.25" step="0.25" value={f.outOf} onChange={set("outOf")} className={fieldClass} required />)}
            </>
          )}
          {kind === "exam_added" && (
            <>
              {field("ev-examkind", "نوع الاختبار", <input id="ev-examkind" value={f.examKind} onChange={set("examKind")} className={fieldClass} maxLength={80} required />)}
              {field("ev-examdate", "تاريخ الاختبار", <input id="ev-examdate" type="date" value={f.examDate} onChange={set("examDate")} className={fieldClass} required />)}
              {field("ev-starttime", "وقت الاختبار (اختياري)", <input id="ev-starttime" type="time" value={f.startTime} onChange={set("startTime")} className={fieldClass} />, "بتوقيت السعودية.")}
            </>
          )}
          {kind === "exam_cancelled" &&
            field("ev-exam", "الاختبار", (
              <select id="ev-exam" value={f.examId} onChange={set("examId")} className={fieldClass} required>
                <option value="">اختر الاختبار</option>
                {panel.examsToCancel.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            ), panel.examsToCancel.length === 0 ? "لا توجد اختبارات مجدولة." : undefined)}
          {kind === "excuse_accepted" &&
            field("ev-absence", "الغياب الذي قُبل عذره", (
              <select id="ev-absence" value={f.attendanceEventId} onChange={set("attendanceEventId")} className={fieldClass} required>
                <option value="">اختر الغياب</option>
                {panel.absencesToExcuse.map((a) => <option key={a.eventId} value={a.eventId}>{a.label}</option>)}
              </select>
            ), panel.absencesToExcuse.length === 0 ? "سجّل غيابًا أو تأخرًا من هذه اللوحة أولًا." : "يتحول الغياب إلى «غياب بعذر» ويُلغى تحديثه إن لم يُرسل.")}
        </div>

        <p className="rounded-xl bg-mint-100 p-4 text-lg text-ink">
          <strong className="text-brand-800">سيُسجَّل لـ{panel.student.name}:</strong> {summary}
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" aria-disabled={busy || undefined} className={primaryButton}>
          {busy ? "جارٍ الحفظ…" : "حفظ الحدث"}
        </button>
      </form>

      {result && <EvaluationResult result={result} name={name} />}
    </section>
  );
}

function EvaluationResult({ result, name }: { result: Result; name: string }) {
  return (
    <div role="status" className="mt-5 space-y-2 rounded-xl border-2 border-mint-300 p-4 text-lg">
      <p className="font-bold text-ink">
        {result.duplicate ? "هذا الحدث محفوظ سابقًا (لم يُكرر):" : "حُفظ الحدث:"} {result.event.summary}
      </p>
      {result.excuse ? (
        <p className="text-ink">
          {result.excuse.outcome === "cancelled"
            ? `أصبح الغياب «غياب بعذر» وأُلغي تحديث ${name} قبل إرساله.`
            : result.excuse.outcome === "already-sent"
              ? "أصبح الغياب «غياب بعذر»، لكن تحديثه أُرسل قبل قبول العذر ولا يمكن استعادته."
              : "أصبح الغياب «غياب بعذر»."}
        </p>
      ) : result.notification ? (
        <>
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-ink">نتيجة التقييم:</span>
            <StatusBadge status={result.notification.status} />
            <MethodLabel method={result.notification.method} />
          </p>
          <p className="text-ink">{result.notification.reason}</p>
          {result.notification.dueLabel && <p className="text-ink">الموعد: {result.notification.dueLabel} بتوقيت السعودية.</p>}
          <p className="text-base text-ink">للمعاينة أو التشغيل استخدم بطاقة الحدث في السجل أدناه.</p>
        </>
      ) : null}
    </div>
  );
}
