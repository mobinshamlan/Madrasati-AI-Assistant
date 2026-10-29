"use client";

import Image from "next/image";
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
  const [runKey, setRunKey] = useState(newKey);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [openAttempts, setOpenAttempts] = useState(false);

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
    setOpenAttempts(true);
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
    <article className="studio-event">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="m-0 text-base font-extrabold">{event.summary}</p>
          <p className="m-0 text-xs text-[var(--studio-muted)]">تاريخ الحدث: {arabicDay(event.event_date)}</p>
        </div>
        {n && <StatusBadge status={n.status} />}
      </header>

      {!n ? (
        <p className="m-0 text-sm">هذا الحدث لا ينتج تحديثًا مستقلًا (قبول عذر).</p>
      ) : (
        <>
          <p className="m-0 text-sm leading-6">{n.reason}</p>
          <p className="m-0 flex flex-wrap items-center gap-3 text-sm">
            {n.method && <MethodLabel method={n.method} />}
            {n.due_at && <span>الموعد: {arabicMoment(n.due_at)}</span>}
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadPreview} aria-disabled={busy !== null || undefined} className={secondaryButton}>
              {busy === "preview" ? "جارٍ إعداد المعاينة…" : "معاينة التحديث"}
            </button>
            {canRun && (
              <button type="button" onClick={() => setConfirm({ resendOf: null })} className={primaryButton}>
                تشغيل التحديث الآن
              </button>
            )}
          </div>
          {!preview && n.status !== "suppressed" && n.status !== "cancelled" && !SENT.has(n.status) && (
            <p className="m-0 text-xs text-[var(--studio-muted)]">اعرض المعاينة أولًا؛ التشغيل يستخدم آخر تفضيلات محفوظة.</p>
          )}

          {preview && <PreviewBox preview={preview} />}
          {outcome && (
            <p role="status" className="studio-alert studio-saved m-0">
              {outcome}
            </p>
          )}
          {error && <ErrorNote>{error}</ErrorNote>}

          {attempts.length > 0 && (
            <section aria-label={`سجل محاولات «${event.summary}»`}>
              <button
                type="button"
                className="studio-btn-secondary"
                aria-expanded={openAttempts}
                onClick={() => setOpenAttempts((v) => !v)}
              >
                {openAttempts ? "إخفاء المحاولات" : `المحاولات (${attempts.length})`}
              </button>
              {openAttempts && (
                <ul className="studio-timeline mt-2">
                  {attempts.map((a) => (
                    <li key={a.id} className="studio-swap">
                      <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                        <StatusBadge
                          status={a.status}
                          label={a.status === "accepted" && a.provider === "mock" ? "قُبل لدى المزود الوهمي" : undefined}
                        />
                        <MethodLabel method={a.method} />
                        <span>{a.kind === "resend" ? "إعادة إرسال" : "إرسال"}</span>
                        <span>{a.provider === "mock" ? "وهمي" : "Twilio"}</span>
                      </p>
                      <p className="m-0 mt-1 text-xs text-[var(--studio-muted)]">
                        {arabicMoment(a.created_at)}
                        {a.destination_masked ? ` — إلى ${a.destination_masked}` : ""}
                        {a.provider_status ? ` — ${a.provider_status}` : ""}
                      </p>
                      {a.ran_early && a.original_due_at && (
                        <p className="m-0 text-xs">شُغّل مبكرًا؛ الموعد الأصلي {arabicMoment(a.original_due_at)}.</p>
                      )}
                      {a.error_message && <p className="m-0 text-sm font-bold text-[#b42318]">{a.error_message}</p>}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {a.provider === "twilio" && (a.status === "accepted" || a.status === "sending") && (
                          <button type="button" onClick={() => refresh(a.id)} className="min-h-10 text-sm font-bold text-[var(--studio-teal)] underline underline-offset-4">
                            تحديث الحالة من المزود
                          </button>
                        )}
                        {a.id === lastAttempt?.id && preview && preview.status !== "suppressed" && (
                          <button
                            type="button"
                            onClick={() => setConfirm({ resendOf: a.id })}
                            className="min-h-10 text-sm font-bold text-[#b42318] underline underline-offset-4"
                          >
                            {a.status === "failed" ? "إعادة المحاولة" : "إعادة إرسال مقصودة"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
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
            <p className="flex flex-wrap items-center gap-2">
              <strong>الطريقة:</strong> <MethodLabel method={preview.method} />
            </p>
            {preview.status === "waiting" && preview.dueLabel && <p>الموعد الأصلي {preview.dueLabel}؛ سيُتجاوز الانتظار للديمو فقط.</p>}
            <p className="whitespace-pre-line rounded-lg bg-[var(--studio-ground)] p-3">{preview.method === "call" ? preview.callOpening : preview.message}</p>
            <p className="text-sm">يُرسل إلى رقم الاختبار المضبوط في خادم Python فقط. المزود الافتراضي وهمي ولا يرسل شيئًا.</p>
          </>
        )}
      </ConfirmDialog>
    </article>
  );
}

function PreviewBox({ preview }: { preview: Preview }) {
  const isCall = preview.method === "call";
  return (
    <div role="status" className="studio-preview studio-swap text-sm">
      <p className="m-0 flex flex-wrap items-center gap-2">
        <strong>المعاينة</strong>
        <StatusBadge status={preview.status} />
        <MethodLabel method={preview.method} />
      </p>
      <p className="mt-2 mb-0">{preview.reason}</p>
      {preview.note && <p className="mt-1 mb-0 font-bold">{preview.note}</p>}
      {preview.dueLabel && <p className="mt-1 mb-0">الموعد: {preview.dueLabel} بتوقيت السعودية.</p>}
      {preview.window && (
        <p className="mt-1 mb-0">
          فترة الملخص الشهري: من {preview.window.start} إلى {preview.window.end}.
        </p>
      )}
      {preview.status !== "suppressed" && (
        <div className="studio-call-preview mt-3">
          {isCall && (
            <div className="shrink-0 text-center">
              <Image src="/characters/combined.png" alt="" width={56} height={56} />
              <div className="studio-bars" aria-hidden="true">
                <i style={{ height: "40%" }} />
                <i style={{ height: "70%" }} />
                <i style={{ height: "55%" }} />
                <i style={{ height: "90%" }} />
                <i style={{ height: "45%" }} />
              </div>
              <p className="m-0 text-[0.65rem] font-bold text-[var(--studio-muted)]">معاينة — بلا صوت</p>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="m-0 font-extrabold text-[var(--studio-teal)]">{isCall ? "أول ما تقوله لولوة:" : "نص الرسالة:"}</p>
            <p className="mt-1 mb-0 whitespace-pre-line leading-7">{isCall ? preview.callOpening : preview.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
