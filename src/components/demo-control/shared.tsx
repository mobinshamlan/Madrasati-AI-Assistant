"use client";

import { useEffect, useRef } from "react";
import { CheckIcon, ClockIcon, CloseIcon, InfoIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";

export type StudioView = "run" | "log" | "guide" | "manage";

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

export const primaryButton = "studio-btn aria-disabled:opacity-70";
export const secondaryButton = "studio-btn-secondary aria-disabled:opacity-70";
export const dangerButton = "studio-btn-danger aria-disabled:opacity-70";
export const fieldClass = "studio-field";
export const labelClass = "studio-label";

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="notice notice-danger" style={{ fontSize: "0.9rem", padding: "0.7rem 0.85rem" }}>
      {children}
    </p>
  );
}

type Status = "suppressed" | "waiting" | "ready" | "sending" | "accepted" | "delivered" | "failed" | "cancelled";

const statusLook: Record<Status, { label: string; tone: string; Icon: typeof InfoIcon }> = {
  suppressed: { label: "متوقف حسب التفضيلات", tone: "off", Icon: CloseIcon },
  waiting: { label: "بانتظار الموعد", tone: "wait", Icon: ClockIcon },
  ready: { label: "جاهز", tone: "ready", Icon: CheckIcon },
  sending: { label: "قيد الإرسال", tone: "info", Icon: ClockIcon },
  accepted: { label: "قُبل لدى المزود", tone: "info", Icon: InfoIcon },
  delivered: { label: "تم التسليم", tone: "ok", Icon: CheckIcon },
  failed: { label: "فشل", tone: "danger", Icon: CloseIcon },
  cancelled: { label: "أُلغي", tone: "off", Icon: CloseIcon },
};

/** Colour always comes with an icon and words. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const look = statusLook[status as Status] ?? statusLook.ready;
  return (
    <span className="studio-status" data-tone={look.tone}>
      <look.Icon size={14} className="shrink-0" />
      {label ?? look.label}
    </span>
  );
}

export function MethodLabel({ method }: { method: string | null }) {
  if (!method) return null;
  const Icon = method === "call" ? PhoneIcon : MessageIcon;
  return (
    <span className="inline-flex items-center gap-1.5 font-bold">
      <Icon size={16} />
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
      backRef.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,32rem)] rounded-xl border border-[var(--studio-line,#e0d8cc)] bg-[var(--studio-surface,#fffcf8)] p-0 text-[var(--studio-ink,#1c1917)] shadow-xl"
    >
      <h2
        id="confirm-title"
        className={`px-5 py-3 text-lg font-bold ${danger ? "bg-[#fef3f2] text-[#b42318]" : "bg-[#d7ebe6] text-[#0b4f4c]"}`}
      >
        {title}
      </h2>
      <div className="space-y-4 px-5 py-4 text-base leading-7">
        {children}
        <div className="flex flex-col gap-2">
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
