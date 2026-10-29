"use client";

import { useEffect, useRef } from "react";
import { CheckIcon, ClockIcon, CloseIcon, InfoIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";

/** JSON request to the operator API. Never throws; failures come back as an Arabic message. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; extra: Record<string, unknown> }> {
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

export const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const primaryButton =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 text-lg font-bold text-white transition-colors hover:bg-brand-700 aria-disabled:cursor-wait aria-disabled:opacity-70";
export const secondaryButton =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-6 text-lg font-bold text-brand-700 transition-colors hover:bg-mint-100 aria-disabled:cursor-wait aria-disabled:opacity-70";
export const dangerButton =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-[#b42318] bg-white px-6 text-lg font-bold text-[#b42318] transition-colors hover:bg-[#fff6f5] aria-disabled:cursor-wait aria-disabled:opacity-70";
export const fieldClass =
  "block min-h-12 w-full rounded-lg border-2 border-[#6c737f] bg-white px-3 text-lg text-ink focus:border-brand-600";
export const labelClass = "mb-1 block font-bold text-ink";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]">
      {children}
    </p>
  );
}

type Status = "suppressed" | "waiting" | "ready" | "sending" | "accepted" | "delivered" | "failed" | "cancelled";

const statusLook: Record<Status, { label: string; className: string; Icon: typeof InfoIcon }> = {
  suppressed: { label: "متوقف حسب تفضيلات ولي الأمر", className: "bg-[#f2f4f7] text-[#344054] ring-[#d0d5dd]", Icon: CloseIcon },
  waiting: { label: "بانتظار الموعد", className: "bg-[#fffaeb] text-[#93370d] ring-[#fedf89]", Icon: ClockIcon },
  ready: { label: "جاهز للمعاينة والإرسال", className: "bg-mint-100 text-brand-800 ring-mint-300", Icon: CheckIcon },
  sending: { label: "قيد الإرسال", className: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]", Icon: ClockIcon },
  accepted: { label: "قُبل لدى المزود", className: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]", Icon: InfoIcon },
  delivered: { label: "تم التسليم", className: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]", Icon: CheckIcon },
  failed: { label: "فشل", className: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]", Icon: CloseIcon },
  cancelled: { label: "أُلغي", className: "bg-[#f2f4f7] text-[#344054] ring-[#d0d5dd]", Icon: CloseIcon },
};

/** Colour always comes with an icon and words. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const look = statusLook[status as Status] ?? statusLook.ready;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-bold ring-1 ${look.className}`}>
      <look.Icon size={18} className="shrink-0" />
      {label ?? look.label}
    </span>
  );
}

export function MethodLabel({ method }: { method: string | null }) {
  if (!method) return null;
  const Icon = method === "call" ? PhoneIcon : MessageIcon;
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-ink">
      <Icon size={20} className="text-brand-700" />
      {method === "call" ? "اتصال" : "رسالة"}
    </span>
  );
}

/** An in-page confirmation (native modal dialog: focus trap and Escape for free). */
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
  const ref = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      backRef.current?.focus(); // the safe choice first
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-line bg-white p-0 text-ink shadow-xl"
    >
      <h2 id="confirm-title" className={`px-5 py-4 text-xl font-bold ${danger ? "bg-[#fef3f2] text-[#b42318]" : "bg-mint-200 text-brand-800"}`}>
        {title}
      </h2>
      <div className="space-y-5 px-5 py-5 text-lg leading-8">
        {children}
        <div className="flex flex-col gap-3">
          <button type="button" onClick={onConfirm} aria-disabled={busy || undefined} className={danger ? dangerButton : primaryButton}>
            {busy ? "جارٍ التنفيذ…" : confirmLabel}
          </button>
          <button ref={backRef} type="button" onClick={onClose} className={secondaryButton}>
            رجوع دون تنفيذ
          </button>
        </div>
      </div>
    </dialog>
  );
}
