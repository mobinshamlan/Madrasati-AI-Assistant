"use client";

import { useState } from "react";
import { arabicDay, arabicMoment } from "@/lib/tammeni/evaluate";
import { api, ConfirmDialog, ErrorNote, MethodLabel, newKey, primaryButton, secondaryButton, StatusBadge } from "./shared";

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

export function NotificationCard({
  studentName,
  event,
  attempts,
  onChanged,
}: {
  studentName: string;
  event: { id: string; kind: string; event_date: string; summary: string; notification: NotificationRow | null };
  attempts: AttemptRow[];
  onChanged: () => void;
}) {
  const n = event.notification;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "run" | "refresh">(null);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | { resendOf: string | null }>(null);
  // One key per run intent: retrying the same click never sends twice; a new key only after a result.
  const [runKey, setRunKey] = useState(newKey);
  const [outcome, setOutcome] = useState<string | null>(null);

  const loadPreview = async () => {
    if (!n || busy) return;
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
      // Preferences changed since the preview: show the new preview; nothing was sent.
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
        ? `فشل الإرسال: ${a.error_message ?? "سبب غير معروف."}`
        : a.provider === "mock"
          ? `قُبل لدى المزود الوهمي${where}. لم يُرسل شيء فعليًا.`
          : `قُبل الطلب لدى Twilio${where}. هذا قبول للطلب وليس تأكيد تسليم؛ استخدم «تحديث الحالة».`,
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

  const canRun = n && preview && !SENT.has(n.status) && n.status !== "cancelled" && n.status !== "failed" && preview.status !== "suppressed";
  const lastAttempt = attempts[0];

  return (
    <article className="space-y-3 rounded-xl border border-line bg-white p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-ink">{event.summary}</p>
          <p className="text-base text-ink">تاريخ الحدث: {arabicDay(event.event_date)}</p>
        </div>
        {n && <StatusBadge status={n.status} label={n.status === "suppressed" ? "متوقف" : undefined} />}
      </header>

      {!n ? (
        <p className="text-base text-ink">هذا الحدث لا ينتج تحديثًا مستقلًا (قبول عذر).</p>
      ) : (
        <>
          <dl className="space-y-1 text-lg">
            <div className="flex flex-wrap gap-x-2"><dt className="font-bold text-brand-800">السبب:</dt><dd className="text-ink">{n.reason}</dd></div>
            {n.method && <div className="flex flex-wrap gap-x-2"><dt className="font-bold text-brand-800">الطريقة:</dt><dd><MethodLabel method={n.method} /></dd></div>}
            {n.due_at && <div className="flex flex-wrap gap-x-2"><dt className="font-bold text-brand-800">الموعد:</dt><dd className="text-ink">{arabicMoment(n.due_at)} بتوقيت السعودية</dd></div>}
          </dl>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={loadPreview} aria-disabled={busy !== null || undefined} className={secondaryButton}>
              {busy === "preview" ? "جارٍ إعداد المعاينة…" : "معاينة التحديث"}
            </button>
            {canRun && (
              <button type="button" onClick={() => setConfirm({ resendOf: null })} className={primaryButton}>
                تشغيل التحديث الآن — للديمو
              </button>
            )}
          </div>
          {!preview && n.status !== "suppressed" && n.status !== "cancelled" && !SENT.has(n.status) && (
            <p className="text-base text-ink">اعرض المعاينة أولًا؛ التشغيل يستخدم آخر تفضيلات محفوظة.</p>
          )}

          {preview && <PreviewBox preview={preview} />}
          {outcome && <p role="status" className="rounded-xl bg-mint-100 p-4 font-bold text-brand-800">{outcome}</p>}
          {error && <ErrorNote>{error}</ErrorNote>}

          {attempts.length > 0 && (
            <section aria-label={`سجل محاولات «${event.summary}»`} className="space-y-2">
              <h4 className="font-bold text-ink">المحاولات</h4>
              <ul className="space-y-2">
                {attempts.map((a) => (
                  <li key={a.id} className="space-y-1 rounded-lg bg-[#f9fafb] p-3 text-base">
                    <p className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} label={a.status === "accepted" && a.provider === "mock" ? "قُبل لدى المزود الوهمي" : undefined} />
                      <MethodLabel method={a.method} />
                      <span className="text-ink">{a.kind === "resend" ? "إعادة إرسال مقصودة" : "إرسال"} — {a.provider === "mock" ? "مزود وهمي" : "Twilio"}</span>
                    </p>
                    <p className="text-ink">
                      {arabicMoment(a.created_at)}
                      {a.destination_masked ? ` — إلى ${a.destination_masked}` : ""}
                      {a.provider_status ? ` — حالة المزود: ${a.provider_status}` : ""}
                    </p>
                    {a.ran_early && a.original_due_at && <p className="text-ink">شُغّل مبكرًا للديمو؛ الموعد الأصلي {arabicMoment(a.original_due_at)}.</p>}
                    {a.error_message && <p className="font-bold text-[#b42318]">{a.error_message}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {a.provider === "twilio" && (a.status === "accepted" || a.status === "sending") && (
                        <button type="button" onClick={() => refresh(a.id)} className="min-h-11 rounded-lg px-3 font-bold text-brand-700 underline underline-offset-4">
                          تحديث الحالة من المزود
                        </button>
                      )}
                      {a.id === lastAttempt?.id && preview && preview.status !== "suppressed" && (
                        <button type="button" onClick={() => setConfirm({ resendOf: a.id })} className="min-h-11 rounded-lg px-3 font-bold text-[#b42318] underline underline-offset-4">
                          {a.status === "failed" ? "إعادة المحاولة" : "إعادة إرسال مقصودة"}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        busy={busy === "run"}
        title={confirm?.resendOf ? `إعادة إرسال لـ${studentName}؟` : `تشغيل التحديث الآن لـ${studentName}؟`}
        confirmLabel={confirm?.resendOf ? "نعم، أعد الإرسال" : "نعم، شغّل الآن"}
        onClose={() => setConfirm(null)}
        onConfirm={() => run(confirm?.resendOf ?? null)}
      >
        {preview && (
          <>
            <p className="flex flex-wrap items-center gap-2"><strong>الطريقة:</strong> <MethodLabel method={preview.method} /></p>
            {preview.status === "waiting" && preview.dueLabel && <p>الموعد الأصلي {preview.dueLabel}؛ سيُتجاوز الانتظار للديمو فقط.</p>}
            <p className="whitespace-pre-line rounded-lg bg-mint-100 p-3">{preview.method === "call" ? preview.callOpening : preview.message}</p>
            <p className="text-base">يُرسل إلى رقم الاختبار المضبوط في خادم Python فقط (لا يُختار من هنا). المزود الافتراضي وهمي ولا يرسل شيئًا.</p>
          </>
        )}
      </ConfirmDialog>
    </article>
  );
}

function PreviewBox({ preview }: { preview: Preview }) {
  return (
    <div role="status" className="space-y-2 rounded-xl border-2 border-mint-300 p-4 text-lg">
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-ink">المعاينة:</span>
        <StatusBadge status={preview.status} />
        <MethodLabel method={preview.method} />
      </p>
      <p className="text-ink">{preview.reason}</p>
      {preview.note && <p className="font-bold text-ink">{preview.note}</p>}
      {preview.dueLabel && <p className="text-ink">الموعد: {preview.dueLabel} بتوقيت السعودية.</p>}
      {preview.window && <p className="text-ink">فترة الملخص الشهري: من {preview.window.start} إلى {preview.window.end}.</p>}
      {preview.status !== "suppressed" && (
        <>
          <p className="font-bold text-brand-800">{preview.method === "call" ? "أول ما تقوله لولوة في المكالمة:" : "نص الرسالة:"}</p>
          <p className="whitespace-pre-line rounded-lg bg-mint-100 p-3 text-ink">{preview.method === "call" ? preview.callOpening : preview.message}</p>
        </>
      )}
    </div>
  );
}
