"use client";

import { useState } from "react";
import { AttendanceIcon, CheckIcon, CloseIcon, ExamIcon, GradesIcon } from "@/components/dashboard/icons";
import { addDays, arabicDay, arabicTime, weekday } from "@/lib/tammeni/evaluate";
import type { Panel } from "./student-panel";
import { api, DecisionChip, ErrorNote, MethodLabel, newKey } from "./shared";

const fieldClass = "field";
const labelClass = "mb-1.5 block text-[0.875rem] font-semibold text-ink-soft";

type Kind = "attendance" | "grade_published" | "exam_added" | "exam_cancelled" | "excuse_accepted";
const kinds: { value: Kind; label: string; Icon: typeof AttendanceIcon }[] = [
  { value: "attendance", label: "حضور وغياب", Icon: AttendanceIcon },
  { value: "grade_published", label: "درجة جديدة", Icon: GradesIcon },
  { value: "exam_added", label: "اختبار جديد", Icon: ExamIcon },
  { value: "exam_cancelled", label: "إلغاء اختبار", Icon: CloseIcon },
  { value: "excuse_accepted", label: "قبول عذر", Icon: CheckIcon },
];
const statusOptions = [
  { value: "absent", label: "غياب" },
  { value: "late", label: "تأخر" },
  { value: "present", label: "حضور" },
  { value: "excused", label: "غياب بعذر" },
];

/** The nearest school day (Sunday–Thursday) from `day`, stepping by `step` days. */
function schoolDay(day: string, step: 1 | -1) {
  let d = day;
  while (weekday(d) === 5 || weekday(d) === 6) d = addDays(d, step);
  return d;
}

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
    date: schoolDay(today, -1),
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
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const subjects = panel.formOptions?.subjects ?? [];
  const assessments = [...new Set([...(panel.formOptions?.assessments ?? []), "اختبار قصير", "اختبار شهري", "اختبار نهائي", "واجب", "مشاركة", "مشروع"])];
  const examKinds = [...new Set([...(panel.formOptions?.examKinds ?? []), "اختبار قصير", "اختبار شهري", "اختبار نهائي", "اختبار عملي", "اختبار شفهي"])];
  const maxScore = Number(f.outOf);
  const scores = Number.isFinite(maxScore) && maxScore > 0 && maxScore <= 1000
    ? Array.from({ length: Math.floor(maxScore) + 1 }, (_, i) => String(Math.floor(maxScore) - i))
    : [];
  const pick = (preferred: string) => (subjects.includes(preferred) ? preferred : subjects[0] ?? preferred);
  // One-click starters: each fills the form (nothing is saved until «سجّل الحدث»).
  const starters: { label: string; kind: Kind; fill: Partial<typeof f> }[] = [
    { label: "غياب", kind: "attendance", fill: { date: schoolDay(today, -1), status: "absent" } },
    { label: "درجة 6 من 10", kind: "grade_published", fill: { date: today, subject: pick("الرياضيات"), assessment: "اختبار قصير", outOf: "10", score: "6" } },
    { label: "اختبار قادم", kind: "exam_added", fill: { date: today, subject: pick("العلوم"), examKind: "اختبار قصير", examDate: schoolDay(addDays(today, 1), 1), startTime: "08:00" } },
  ];
  const applyStarter = (s: (typeof starters)[number]) => {
    setKind(s.kind);
    setF((x) => ({ ...x, ...s.fill }));
    setResult(null);
    setError("");
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const summary = (() => {
    if (kind === "attendance") return `${statusOptions.find((s) => s.value === f.status)?.label} يوم ${f.date ? arabicDay(f.date) : "—"}`;
    if (kind === "grade_published") return `درجة ${f.subject || "—"}: ${f.assessment || "—"} (${f.score || "—"} من ${f.outOf || "—"})، تاريخ النشر ${f.date ? arabicDay(f.date) : "—"}`;
    if (kind === "exam_added") return `اختبار ${f.subject || "—"} يوم ${f.examDate ? arabicDay(f.examDate) : "—"}${f.startTime ? `، ${arabicTime(f.startTime)}` : ""}`;
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
    if (!r.ok) return setError(r.error);
    setResult(r.data);
    setKey(newKey());
    onSaved();
  };

  const field = (id: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {input}
      {hint && <p className="mt-1 text-[0.8125rem] leading-5 text-faint">{hint}</p>}
    </div>
  );

  return (
    <section aria-labelledby="event-title" className="sheet p-5">
      <h2 id="event-title" className="text-[1.125rem] font-semibold">
        سجّل حدثًا لـ{name}
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[0.875rem] text-faint">جرّب مثال:</span>
        {starters.map((s) => (
          <button key={s.label} type="button" onClick={() => applyStarter(s)} className="btn-secondary btn-sm">
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-4">
        <fieldset className="min-w-0">
          <legend className={labelClass}>نوع الحدث</legend>
          <div className="seg !flex !rounded-2xl">
            {kinds.map((k) => (
              <label key={k.value} className="!min-h-11 !rounded-xl !px-3 text-[0.875rem]">
                <input
                  type="radio"
                  name="event-kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => {
                    setKind(k.value);
                    setResult(null);
                    setError("");
                  }}
                  className="sr-only"
                />
                <k.Icon size={16} />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div key={kind} className="arrive grid gap-3 sm:grid-cols-2">
          {field(
            "ev-date",
            kind === "grade_published" ? "تاريخ النشر" : "تاريخ الحدث (يوم دراسي)",
            <input id="ev-date" type="date" value={f.date} onChange={set("date")} className={`${fieldClass} num`} required />,
          )}
          {kind === "attendance" &&
            field(
              "ev-status",
              "الحالة",
              <select id="ev-status" value={f.status} onChange={set("status")} className={fieldClass}>
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>,
              "حضور اليوم الدراسي، مو حصة إلكترونية.",
            )}
          {(kind === "grade_published" || kind === "exam_added") &&
            field("ev-subject", "المادة", <PresetField id="ev-subject" value={f.subject} options={subjects} placeholder="اختر المادة" onChange={(value) => setF((x) => ({ ...x, subject: value }))} inputProps={{ maxLength: 80 }} />)}
          {kind === "grade_published" && (
            <>
              {field("ev-assessment", "اسم التقييم", <PresetField id="ev-assessment" value={f.assessment} options={assessments} placeholder="اختر التقييم" onChange={(value) => setF((x) => ({ ...x, assessment: value }))} inputProps={{ maxLength: 120 }} />)}
              {field("ev-outof", "الدرجة الكاملة", <PresetField id="ev-outof" value={f.outOf} options={["10", "20", "30", "40", "50", "100"]} placeholder="اختر الدرجة الكاملة" onChange={(value) => setF((x) => ({ ...x, outOf: value }))} inputProps={{ type: "number", inputMode: "decimal", min: 0.25, step: 0.25 }} />)}
              {field("ev-score", "الدرجة", <PresetField id="ev-score" value={f.score} options={scores} placeholder="اختر الدرجة" onChange={(value) => setF((x) => ({ ...x, score: value }))} inputProps={{ type: "number", inputMode: "decimal", min: 0, max: maxScore > 0 ? maxScore : undefined, step: 0.25 }} />)}
            </>
          )}
          {kind === "exam_added" && (
            <>
              {field("ev-examkind", "نوع الاختبار", <PresetField id="ev-examkind" value={f.examKind} options={examKinds} placeholder="اختر نوع الاختبار" onChange={(value) => setF((x) => ({ ...x, examKind: value }))} inputProps={{ maxLength: 80 }} />)}
              {field("ev-examdate", "تاريخ الاختبار", <input id="ev-examdate" type="date" value={f.examDate} onChange={set("examDate")} className={`${fieldClass} num`} required />)}
              {field("ev-starttime", "وقت الاختبار (اختياري)", <input id="ev-starttime" type="time" value={f.startTime} onChange={set("startTime")} className={`${fieldClass} num`} />, "بتوقيت السعودية.")}
            </>
          )}
          {kind === "exam_cancelled" &&
            field(
              "ev-exam",
              "الاختبار",
              <select id="ev-exam" value={f.examId} onChange={set("examId")} className={fieldClass} required>
                <option value="">اختر الاختبار</option>
                {panel.examsToCancel.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </select>,
              panel.examsToCancel.length === 0 ? "ما فيه اختبارات مجدولة." : undefined,
            )}
          {kind === "excuse_accepted" &&
            field(
              "ev-absence",
              "الغياب اللي قُبل عذره",
              <select id="ev-absence" value={f.attendanceEventId} onChange={set("attendanceEventId")} className={fieldClass} required>
                <option value="">اختر الغياب</option>
                {panel.absencesToExcuse.map((a) => (
                  <option key={a.eventId} value={a.eventId}>
                    {a.label}
                  </option>
                ))}
              </select>,
              panel.absencesToExcuse.length === 0 ? "سجّل غيابًا أو تأخرًا من هنا أولًا." : "يصير الغياب «غياب بعذر» ويُلغى إشعاره إذا ما أُرسل.",
            )}
        </div>

        <p className="rounded-xl bg-panel px-3.5 py-2.5 text-[0.9375rem] leading-7">
          <span className="text-faint">بيُسجَّل لـ{name}: </span>
          <span className="font-medium">{summary}</span>
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" aria-busy={busy || undefined} className="btn-primary w-full sm:w-auto">
          {busy && <span className="spinner" aria-hidden="true" />}
          {busy ? "جارٍ التسجيل…" : "سجّل الحدث"}
        </button>
      </form>

      {result && <EvaluationResult result={result} name={name} />}
    </section>
  );
}

function PresetField({ id, value, options, placeholder, onChange, inputProps }: {
  id: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  inputProps?: React.ComponentProps<"input">;
}) {
  const [custom, setCustom] = useState(false);
  const isCustom = custom || (value !== "" && !options.includes(value));
  return <div className="space-y-2">
    <select id={id} className={fieldClass} value={isCustom ? "__custom__" : value} required onChange={(e) => {
      const next = e.target.value;
      setCustom(next === "__custom__");
      onChange(next === "__custom__" ? "" : next);
    }}>
      <option value="">{placeholder}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
      <option value="__custom__">إدخال قيمة أخرى…</option>
    </select>
    {isCustom && <>
      <label htmlFor={`${id}-custom`} className="sr-only">{placeholder} — قيمة أخرى</label>
      <input {...inputProps} id={`${id}-custom`} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} required placeholder="أدخل القيمة" />
    </>}
  </div>;
}

function EvaluationResult({ result, name }: { result: Result; name: string }) {
  return (
    <div role="status" className="arrive mt-4 rounded-xl border border-line p-3.5 text-[0.9375rem] leading-7">
      <p className="font-semibold">
        {result.duplicate ? "هذا الحدث مسجّل من قبل (ما تكرر): " : "تم التسجيل: "}
        <span className="font-normal">{result.event.summary}</span>
      </p>
      {result.excuse ? (
        <p className="mt-1 text-ink-soft">
          {result.excuse.outcome === "cancelled"
            ? `صار الغياب «غياب بعذر» وأُلغي إشعار ${name} قبل إرساله.`
            : result.excuse.outcome === "already-sent"
              ? "صار الغياب «غياب بعذر»، لكن إشعاره أُرسل قبل قبول العذر وما يُسترجع."
              : "صار الغياب «غياب بعذر»."}
        </p>
      ) : result.notification ? (
        <>
          <p className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="text-faint">قرار طمّني:</span>
            <DecisionChip status={result.notification.status} />
            <span className="text-[0.875rem] text-ink-soft">
              <MethodLabel method={result.notification.method} />
            </span>
          </p>
          <p className="mt-1 text-ink-soft">
            {result.notification.reason}
            {result.notification.dueLabel ? ` الموعد: ${result.notification.dueLabel}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => document.querySelector("li[id^='event-']")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="mt-2 font-semibold text-brand underline underline-offset-4"
          >
            اعرض البطاقة وأرسلها
          </button>
        </>
      ) : null}
    </div>
  );
}
