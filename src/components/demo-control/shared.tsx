"use client";

import { useEffect, useId, useRef } from "react";
import { InfoIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";

/** JSON request to the operator API. Never throws; failures come back as an Arabic message. */
export async function api<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; extra: Record<string, unknown> }> {
  try {
    const response = await fetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: data.error ?? "تعذّر تنفيذ الطلب.", status: response.status, extra: data };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.", status: 0, extra: {} };
  }
}

export const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="notice notice-danger">
      <InfoIcon size={18} />
      <span>{children}</span>
    </p>
  );
}

// ---------- one vocabulary for every state an update can be in ----------

type Tone = "neutral" | "warn" | "brand" | "info" | "ok" | "danger";

/** The decision and the update's overall state, as the operator reads them. */
export const decisionLook: Record<string, { label: string; tone: Tone }> = {
  suppressed: { label: "لن يُرسل", tone: "neutral" },
  waiting: { label: "بانتظار الموعد", tone: "warn" },
  ready: { label: "جاهز للإرسال", tone: "brand" },
  sending: { label: "جارٍ الإرسال", tone: "info" },
  accepted: { label: "قُبل الطلب", tone: "info" },
  delivered: { label: "تم التسليم", tone: "ok" },
  failed: { label: "فشل الإرسال", tone: "danger" },
  cancelled: { label: "أُلغي", tone: "neutral" },
};

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span className="chip" data-tone={tone === "neutral" ? undefined : tone}>
      {label}
    </span>
  );
}

export function DecisionChip({ status }: { status: string }) {
  const look = decisionLook[status] ?? { label: status, tone: "neutral" as Tone };
  return <StatusChip {...look} />;
}

export type AttemptLike = { provider: string; method: string; status: string };

export const isMock = (a: Pick<AttemptLike, "provider">) => a.provider === "mock";

/**
 * One attempt in words. A mock attempt never reached a phone, so it is never called "accepted" or
 * "delivered"; a real one says "accepted" until the provider confirms delivery.
 */
export function attemptLook(a: AttemptLike): { label: string; tone: Tone } {
  const call = a.method === "call";
  if (a.status === "failed") return { label: "فشل", tone: "danger" };
  if (isMock(a)) return { label: "سُجّل تجريبيًا — ما وصل لأحد", tone: "neutral" };
  if (a.status === "delivered") return { label: call ? "اكتملت المكالمة" : "وصلت الرسالة", tone: "ok" };
  if (a.status === "accepted") return { label: "أُرسل — ما تأكد التسليم", tone: "info" };
  if (a.status === "sending") return { label: "جارٍ الإرسال", tone: "info" };
  return decisionLook[a.status] ?? { label: a.status, tone: "neutral" };
}

export function ModeChip({ provider }: { provider: string }) {
  return isMock({ provider }) ? (
    <span className="chip" data-tone="outline">
      إرسال تجريبي
    </span>
  ) : (
    <span className="chip" data-tone="warn">
      إرسال فعلي
    </span>
  );
}

/** The provider's own status word, in Arabic, for the details line. */
const providerWords: Record<string, string> = {
  "mock-accepted": "سُجّل تجريبيًا",
  queued: "في الانتظار لدى المزوّد",
  accepted: "استلمه المزوّد",
  sending: "قيد الإرسال",
  sent: "خرجت من المزوّد",
  delivered: "وصلت",
  undelivered: "ما وصلت",
  failed: "فشلت",
  initiated: "بدأ الاتصال",
  ringing: "يرن",
  "in-progress": "المكالمة جارية",
  completed: "اكتملت",
  busy: "الخط مشغول",
  "no-answer": "ما رد",
  canceled: "أُلغيت",
};
export const providerWord = (s: string | null) => (s ? (providerWords[s] ?? s) : null);

export function MethodLabel({ method }: { method: string | null }) {
  if (!method) return null;
  const Icon = method === "call" ? PhoneIcon : MessageIcon;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={16} />
      {method === "call" ? "اتصال" : "رسالة"}
    </span>
  );
}

/** An in-page confirmation (native modal dialog: focus trap and Escape for free). The safe choice has focus. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      backRef.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby={titleId} aria-describedby={descriptionId} className="m-auto w-[min(92vw,32rem)] rounded-2xl bg-surface p-0 text-ink shadow-xl">
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id={titleId} className={`text-[1.25rem] font-bold ${danger ? "text-danger" : ""}`}>
          {title}
        </h2>
        <div id={descriptionId} className="space-y-3 text-[0.9375rem] leading-7">{children}</div>
        <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse sm:justify-start">
          <button type="button" onClick={onConfirm} aria-busy={busy || undefined} className={danger ? "btn-danger" : "btn-primary"}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {busy ? "جارٍ التنفيذ…" : confirmLabel}
          </button>
          <button ref={backRef} type="button" onClick={onClose} className="btn-secondary">
            رجوع بدون تنفيذ
          </button>
        </div>
      </div>
    </dialog>
  );
}
