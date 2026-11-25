"use client";

import { useRef, useState } from "react";
import { AttendanceIcon, CheckIcon, ExamIcon, GradesIcon, InfoIcon } from "@/components/dashboard/icons";
import { arabicMoment } from "@/lib/tammeni/evaluate";
import {
  api,
  attemptLook,
  ConfirmDialog,
  DecisionChip,
  ErrorNote,
  isMock,
  MethodLabel,
  ModeChip,
  newKey,
  providerWord,
  StatusChip,
} from "./shared";

export type NotificationRow = {
  id: string;
  topic: string;
  status: string;
  method: string | null;
  due_at: string | null;
  reason: string;
  content: string | null;
};
export type AttemptRow = {
  id: string;
  notification_id: string;
  kind: string;
  provider: string;
  method: string;
  destination_masked: string | null;
  status: string;
  provider_status: string | null;
  error_message: string | null;
  ran_early: boolean;
  original_due_at: string | null;
  triggered_by?: string;
  created_at: string;
};
type Preview = {
  status: string;
  method: string | null;
  reason: string;
  dueLabel: string | null;
  window: { start: string; end: string } | null;
  message: string | null;
  callOpening: string | null;
  facts: string[];
  prefsVersion: string | null;
  note: string | null;
};

const SENT = new Set(["sending", "accepted", "delivered"]);
const kindIcons: Record<string, typeof AttendanceIcon> = {
  attendance: AttendanceIcon,
  grade_published: GradesIcon,
  exam_added: ExamIcon,
  exam_cancelled: ExamIcon,
  excuse_accepted: CheckIcon,
};

export function NotificationCard({
  studentId,
  studentName,
  event,
  attempts,
  realDispatch,
  isFresh,
  onChanged,
}: {
  studentId: string;
  studentName: string;
  event: { id: string; kind: string; event_date: string; summary: string; notification: NotificationRow | null };
  attempts: AttemptRow[];
  realDispatch: boolean;
  isFresh: boolean;
  onChanged: () => void;
}) {
  const n = event.notification;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "run" | "refresh" | "delete">(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | { resendOf: string | null }>(null);
  const [runKey, setRunKey] = useState(newKey);
  const [outcome, setOutcome] = useState<{ tone: "ok" | "info" | "danger"; text: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(null);
  const rowActionRef = useRef<HTMLButtonElement>(null);

  // «معاينة»: the server re-evaluates with the latest saved preferences and returns the exact text. Nothing is sent.
  const loadPreview = async () => {
    if (!n || busy) return;
    setExpandedOverride(true);
    setBusy("preview");
    setError("");
    const r = await api<Preview>(`/api/demo-control/notifications/${n.id}/preview`, { method: "POST" });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setPreview(r.data);
    onChanged();
  };

  const run = async (resendOf: string | null) => {
    if (!n || busy || !preview) return;
    setBusy("run");
    setError("");
    setOutcome(null);
    const r = await api<{ duplicate: boolean; attempt: AttemptRow & { provider: string }; ranEarly?: boolean; originalDue?: string | null }>(
      `/api/demo-control/notifications/${n.id}/run`,
      { method: "POST", body: { idempotencyKey: runKey, prefsVersion: preview.prefsVersion, resendOf } },
    );
    setBusy(null);
    setConfirm(null);
    if (!r.ok) {
      // The preferences changed since the preview: show the new preview, and ask for a fresh look.
      if (r.extra.changed && r.extra.preview) setPreview(r.extra.preview as Preview);
      setError(r.error);
      onChanged();
      return;
    }
    setRunKey(newKey());
    const a = r.data.attempt;
    const where = a.destination_masked ? ` إلى ${a.destination_masked}` : "";
    setOutcome(
      a.status === "failed"
        ? { tone: "danger", text: `فشل الإرسال: ${a.error_message ?? "سبب غير معروف."}` }
        : isMock(a)
          ? { tone: "info", text: "سُجّل الإرسال التجريبي في السجل. ما وصل شيء لأي جوال." }
          : { tone: "ok", text: `قُبل الطلب لدى مزوّد الاتصالات${where}. هذا قبول للطلب، مو تأكيد وصول؛ اضغط «تحديث حالة التسليم» بعد قليل.` },
    );
    onChanged();
  };

  const refresh = async (attemptId: string) => {
    if (busy) return;
    setBusy("refresh");
    setError("");
    const r = await api(`/api/demo-control/attempts/${attemptId}/refresh`, { method: "POST" });
    setBusy(null);
    if (!r.ok) setError(r.error);
    onChanged();
  };

  const deleteEvent = async () => {
    if (busy) return;
    setBusy("delete");
    setError("");
    const r = await api(`/api/demo-control/students/${studentId}/events/${event.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setDeleteOpen(false);
    onChanged();
  };

  const canRun = n && preview && !SENT.has(n.status) && n.status !== "cancelled" && n.status !== "failed" && preview.status !== "suppressed";
  const lastAttempt = attempts[0];
  const method = preview?.method ?? n?.method ?? null;
  const isCall = method === "call";
  const dueLabel = preview ? preview.dueLabel : n?.due_at ? arabicMoment(n.due_at) : null;
  const hasDetail = isFresh || preview !== null || busy === "preview" || outcome !== null || attempts.length > 0;
  const expanded = expandedOverride ?? hasDetail;
  const sendLabel = realDispatch ? (isCall ? "اتصل الآن" : "أرسل الرسالة") : isCall ? "اتصال تجريبي" : "إرسال تجريبي";
  const Icon = kindIcons[event.kind] ?? InfoIcon;
  const visibleAttempts = showAll ? attempts : attempts.slice(0, 1);
  const detailId = `event-detail-${event.id}`;
  const toggleDetails = () => setExpandedOverride((open) => !(open ?? hasDetail));
  const hideDetails = () => {
    setExpandedOverride(false);
    requestAnimationFrame(() => rowActionRef.current?.focus());
  };
  const deleteButton = (
    <button type="button" disabled={busy !== null} onClick={() => { setError(""); setDeleteOpen(true); }} className="btn-quiet btn-sm shrink-0 !text-danger">
      حذف الحدث
    </button>
  );

  return (
    <article aria-labelledby={`ev-${event.id}`} className={`studio-event${expanded ? " is-expanded" : ""}`}>
      <header className="studio-event-header">
        <div className="studio-event-leading">
          <Icon size={20} className="studio-event-icon" />
          <div className="min-w-0 flex-1">
            <div className="studio-event-title-line">
              <h3 id={`ev-${event.id}`}>{event.summary}</h3>
              {n ? <DecisionChip status={preview?.status ?? n.status} /> : <span className="chip">بدون إشعار</span>}
            </div>
            <p className="studio-event-meta">
              {n ? (
                <>
                  <MethodLabel method={method} />
                  {dueLabel && <span>الموعد: {dueLabel}</span>}
                </>
              ) : (
                <span>قبول العذر ما ينتج إشعارًا مستقلًا</span>
              )}
            </p>
          </div>
        </div>
        {n && n.status !== "cancelled" ? (
          <button
            ref={rowActionRef}
            type="button"
            onClick={loadPreview}
            aria-label={`${preview ? "تحديث المعاينة" : "معاينة"} ${isCall ? "المكالمة" : "الرسالة"}: ${event.summary}`}
            aria-controls={detailId}
            aria-expanded={expanded}
            aria-busy={busy === "preview" || undefined}
            disabled={busy !== null && busy !== "preview"}
            className="studio-event-preview btn-secondary btn-sm shrink-0"
          >
            {busy === "preview" && <span className="spinner" aria-hidden="true" />}
            {busy === "preview" ? "جارٍ التحضير…" : preview ? "تحديث المعاينة" : "معاينة"}
          </button>
        ) : (
          <button
            ref={rowActionRef}
            type="button"
            className="btn-quiet btn-sm shrink-0"
            aria-controls={detailId}
            aria-expanded={expanded}
            onClick={toggleDetails}
          >
            {expanded ? "إخفاء التفاصيل" : "تفاصيل الحدث"}
          </button>
        )}
      </header>

      <section id={detailId} aria-label={`تفاصيل ${event.summary}`} className="studio-event-detail" hidden={!expanded}>
          {!n ? (
            <>
              <p className="text-[0.9375rem] leading-7 text-ink-soft">قبول العذر يغيّر سجل الغياب فقط، وما ينتج إشعارًا مستقلًا.</p>
              <div className="studio-event-detail-actions">{deleteButton}</div>
            </>
          ) : (
            <>
              <Steps n={n} previewed={preview !== null} last={lastAttempt} />

              {preview && <PreviewBox preview={preview} />}
              {outcome && (
                <p role="status" className={`notice notice-${outcome.tone} arrive mt-3`}>
                  <InfoIcon size={18} />
                  <span>{outcome.text}</span>
                </p>
              )}
              {error && (
                <div className="mt-3">
                  <ErrorNote>{error}</ErrorNote>
                </div>
              )}

              <div className="studio-event-controls mt-4">
                {canRun && (
                  <button type="button" onClick={() => setConfirm({ resendOf: null })} disabled={busy !== null} className="btn-primary btn-sm">
                    {sendLabel}
                  </button>
                )}
                {!preview && n.status !== "suppressed" && n.status !== "cancelled" && !SENT.has(n.status) && n.status !== "failed" && (
                  <span className="text-[0.875rem] text-faint">اعرض المعاينة أولًا، بعدها يظهر زر الإرسال.</span>
                )}
              </div>

              {attempts.length > 0 && (
                <section aria-label={`محاولات الإرسال: ${event.summary}`} className="mt-4 border-t border-rule pt-3">
                  <h4 className="text-[0.875rem] font-semibold text-ink-soft">محاولات الإرسال ({attempts.length})</h4>
                  <ul className="mt-1 divide-y divide-rule">
                    {visibleAttempts.map((a) => (
                      <li key={a.id} className="py-2.5">
                        <p className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                          <ModeChip provider={a.provider} />
                          <StatusChip {...attemptLook(a)} />
                          <MethodLabel method={a.method} />
                          {a.kind === "resend" && <span className="text-faint">إعادة</span>}
                        </p>
                        <p className="mt-1 text-[0.8125rem] leading-6 text-faint">
                          {arabicMoment(a.created_at)}
                          {a.destination_masked && (
                            <>
                              {" — إلى "}
                              <bdi dir="ltr" className="num">
                                {a.destination_masked}
                              </bdi>
                            </>
                          )}
                          {!isMock(a) && a.provider_status && <> — المزوّد: {providerWord(a.provider_status)}</>}
                          {a.triggered_by === "scheduler" && <> — أُرسل تلقائيًا في موعده</>}
                          {a.ran_early && a.original_due_at && <> — أُرسل قبل موعده ({arabicMoment(a.original_due_at)})</>}
                        </p>
                        {a.error_message && <p className="mt-1 text-[0.875rem] font-medium text-danger">{a.error_message}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {!isMock(a) && (a.status === "accepted" || a.status === "sending") && (
                            <button type="button" onClick={() => refresh(a.id)} disabled={busy !== null} aria-busy={busy === "refresh" || undefined} className="btn-quiet btn-sm">
                              {busy === "refresh" ? "جارٍ السؤال…" : "تحديث حالة التسليم"}
                            </button>
                          )}
                          {a.id === lastAttempt?.id && preview && preview.status !== "suppressed" && (
                            <button type="button" onClick={() => setConfirm({ resendOf: a.id })} disabled={busy !== null} className="btn-quiet btn-sm">
                              {a.status === "failed" ? "حاول مرة ثانية" : isCall ? "اتصل مرة ثانية" : "أرسل مرة ثانية"}
                            </button>
                          )}
                          {a.id === lastAttempt?.id && !preview && n.status !== "suppressed" && (
                            <span className="py-2 text-[0.8125rem] text-faint">لإعادة الإرسال اعرض المعاينة أولًا.</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {attempts.length > 1 && (
                    <button type="button" className="btn-quiet btn-sm" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
                      {showAll ? "إخفاء المحاولات الأقدم" : `عرض كل المحاولات (${attempts.length})`}
                    </button>
                  )}
                </section>
              )}

              <div className="studio-event-detail-footer mt-2">
                <details className="studio-disclosure min-w-0 flex-1 text-[0.875rem]">
                  <summary className="text-ink-soft">ليش هذا القرار؟</summary>
                  <div className="space-y-1 pb-2 leading-6 text-ink-soft">
                    <p>{n.reason}</p>
                    {n.due_at && <p>الموعد حسب التفضيلات: {arabicMoment(n.due_at)} بتوقيت الرياض.</p>}
                  </div>
                </details>
                <button
                  type="button"
                  className="btn-quiet btn-sm shrink-0"
                  aria-controls={detailId}
                  aria-expanded="true"
                  disabled={busy === "run" || busy === "refresh" || busy === "delete"}
                  onClick={hideDetails}
                >
                  إخفاء التفاصيل
                </button>
                {deleteButton}
              </div>
            </>
          )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        busy={busy === "run"}
        title={
          isCall
            ? `${realDispatch ? "" : "اتصال تجريبي — "}الاتصال بولي أمر ${studentName}${confirm?.resendOf ? " مرة ثانية" : ""}؟`
            : `${realDispatch ? "" : "إرسال تجريبي — "}رسالة عن ${studentName}${confirm?.resendOf ? " مرة ثانية" : ""}؟`
        }
        confirmLabel={realDispatch ? (isCall ? "نعم، اتصل" : "نعم، أرسل") : "نعم، سجّل الإرسال التجريبي"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(confirm?.resendOf ?? null)}
      >
        {realDispatch ? (
          <p className="notice notice-warn">
            <InfoIcon size={18} />
            <span>إرسال فعلي: قد يصل {isCall ? "اتصال حقيقي" : "رسالة حقيقية"} لرقم الاختبار المعتمد في الخادم.</span>
          </p>
        ) : (
          <p className="notice notice-info">
            <InfoIcon size={18} />
            <span>إرسال تجريبي: يُسجَّل في السجل فقط، وما يصل شيء لأي جوال.</span>
          </p>
        )}
        {preview && (
          <>
            {preview.status === "waiting" && preview.dueLabel && <p>موعده الأصلي {preview.dueLabel}. الإرسال الآن يتجاوز الانتظار للعرض فقط.</p>}
            <p className="text-[0.8125rem] font-semibold text-faint">{isCall ? "أول ما تقوله لولوة" : "نص الرسالة"}</p>
            <p className="rounded-xl bg-panel p-3 whitespace-pre-line">{isCall ? preview.callOpening : preview.message}</p>
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={deleteOpen}
        danger
        busy={busy === "delete"}
        title={`حذف هذا الحدث لـ${studentName}؟`}
        confirmLabel="نعم، احذف الحدث"
        onClose={() => setDeleteOpen(false)}
        onConfirm={deleteEvent}
      >
        <p className="font-semibold">{event.summary}</p>
        <p>ينحذف الحدث وسجله التجريبي من بيانات الطالب، ويُلغى إشعاره إذا ما أُرسل.</p>
        <p>أي رسالة أو مكالمة أُرسلت قبل ما تُلغى، وسجل الإرسال يبقى محفوظًا.</p>
        {(event.kind === "exam_cancelled" || event.kind === "excuse_accepted") && <p>حذف الإلغاء أو قبول العذر يرجّع حالة السجل المرتبط، بدون إرسال تنبيه جديد.</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </ConfirmDialog>
    </article>
  );
}

/** Decision → preview → send → delivery, in words. A mock send has no delivery to confirm. */
function Steps({ n, previewed, last }: { n: NotificationRow; previewed: boolean; last: AttemptRow | undefined }) {
  type State = "done" | "wait" | "fail" | "stop" | "na" | "todo";
  const sent = SENT.has(n.status) || n.status === "failed" || last !== undefined;
  const decision: [State, string] =
    n.status === "suppressed"
      ? ["stop", "لن يُرسل"]
      : n.status === "cancelled"
        ? ["stop", "أُلغي"]
        : n.status === "waiting"
          ? ["wait", "بانتظار الموعد"]
          : ["done", "جاهز"];
  const preview: [State, string] = previewed || sent ? ["done", previewed ? "عُرضت" : "تمّت"] : decision[0] === "stop" ? ["na", "—"] : ["todo", "لم تُعرض"];
  const send: [State, string] = !last
    ? [decision[0] === "stop" ? "na" : "todo", decision[0] === "stop" ? "—" : "لم يُرسل"]
    : last.status === "failed"
      ? ["fail", "فشل"]
      : ["done", isMock(last) ? "تجريبي" : "فعلي"];
  const delivery: [State, string] = !last
    ? ["na", "—"]
    : last.status === "failed"
      ? ["fail", "ما وصل"]
      : isMock(last)
        ? ["na", "لا ينطبق (تجريبي)"]
        : last.status === "delivered"
          ? ["done", last.method === "call" ? "اكتملت المكالمة" : "وصلت"]
          : ["wait", "ما تأكد"];
  const steps: [string, [State, string]][] = [
    ["القرار", decision],
    ["المعاينة", preview],
    ["الإرسال", send],
    ["التسليم", delivery],
  ];
  return (
    <ol className="studio-steps mt-4" aria-label="مراحل الإشعار">
      {steps.map(([label, [state, detail]]) => (
        <li key={label} data-state={state}>
          <b>{label}</b>
          <span>{detail}</span>
        </li>
      ))}
    </ol>
  );
}

function PreviewBox({ preview }: { preview: Preview }) {
  const isCall = preview.method === "call";
  return (
    <div role="status" className="arrive mt-4 rounded-xl bg-panel p-4">
      <p className="flex flex-wrap items-center gap-2">
        <span className="chip" data-tone="outline">
          معاينة — ما أُرسل شيء
        </span>
        <DecisionChip status={preview.status} />
        <span className="text-[0.875rem] text-ink-soft">
          <MethodLabel method={preview.method} />
        </span>
      </p>
      {preview.note && <p className="mt-2 text-[0.9375rem] font-medium">{preview.note}</p>}
      {preview.status === "suppressed" ? (
        <p className="mt-2 text-[0.9375rem] leading-7">{preview.reason}</p>
      ) : (
        <>
          <p className="mt-3 text-[0.8125rem] font-semibold text-faint">{isCall ? "أول ما تقوله لولوة في المكالمة" : "نص الرسالة"}</p>
          <p className="mt-1 rounded-xl bg-surface p-3 leading-8 whitespace-pre-line">{isCall ? preview.callOpening : preview.message}</p>
          <p className="mt-2 text-[0.8125rem] leading-6 text-faint">
            {preview.dueLabel ? `الموعد حسب التفضيلات: ${preview.dueLabel}. ` : ""}
            {preview.window ? `يشمل الدرجات من ${preview.window.start} إلى ${preview.window.end}. ` : ""}
            {isCall ? "بعدها تكمل لولوة الحوار وتجاوب من سجلات الطالب." : ""}
          </p>
        </>
      )}
    </div>
  );
}
