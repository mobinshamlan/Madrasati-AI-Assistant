"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { InfoIcon, LogoutIcon } from "@/components/dashboard/icons";
import { api, ErrorNote, fieldClass, labelClass, primaryButton, secondaryButton, type StudioView } from "./shared";
import { StudentPanel } from "./student-panel";

type Overview = {
  parent: { name: string } | null;
  students: { id: string; key: string; name: string; firstName: string; grade: string; stage: string | null; school: string }[];
  today: string;
};

const views: { id: StudioView; href: string; label: string }[] = [
  { id: "run", href: "#run", label: "التشغيل" },
  { id: "log", href: "#log", label: "سجل المحاولات" },
  { id: "guide", href: "#guide", label: "إرشادات الديمو" },
];

function readView(): StudioView {
  if (typeof window === "undefined") return "run";
  const h = window.location.hash.replace("#", "");
  if (h === "log" || h === "guide" || h === "manage") return h;
  return "run";
}

export function DemoControl() {
  const [session, setSession] = useState<"checking" | "in" | "out">("checking");
  const [local, setLocal] = useState(false);
  const [localError, setLocalError] = useState("");
  const [sharedError, setSharedError] = useState("");
  const signInLocally = useCallback(async () => {
    setLocalError("");
    const r = await api("/api/demo-control/session/local", { method: "POST" });
    if (r.ok) setSession("in");
    else setLocalError(r.error);
    return r.ok;
  }, []);
  const signInShared = useCallback(async () => {
    setSharedError("");
    const r = await api("/api/demo-control/session/shared", { method: "POST" });
    if (r.ok) setSession("in");
    else setSharedError(r.error);
    return r.ok;
  }, []);
  const check = useCallback(async () => {
    const r = await api<{ signedIn: boolean; local?: boolean; shared?: boolean }>("/api/demo-control/session");
    const isLocal = r.ok && r.data.local === true;
    const isShared = r.ok && r.data.shared === true;
    setLocal(isLocal);
    if (r.ok && r.data.signedIn) return setSession("in");
    if (isLocal && (await signInLocally())) return;
    if (isShared && (await signInShared())) return;
    setSession("out");
  }, [signInLocally, signInShared]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  if (session === "checking") {
    return (
      <p role="status" className="px-6 py-16 text-center text-base text-[var(--studio-muted)]">
        جارٍ التحقق من جلسة المشغّل…
      </p>
    );
  }
  if (session === "out") {
    return <OperatorLogin onSignedIn={() => setSession("in")} local={local} localError={localError} sharedError={sharedError} onLocal={signInLocally} />;
  }
  return <Studio onSignedOut={() => setSession("out")} />;
}

function OperatorLogin({
  onSignedIn,
  local,
  localError,
  sharedError,
  onLocal,
}: {
  onSignedIn: () => void;
  local: boolean;
  localError: string;
  sharedError: string;
  onLocal: () => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await api("/api/demo-control/session", { method: "POST", body: { email, password } });
    setBusy(false);
    if (r.ok) onSignedIn();
    else setError(r.error);
  };
  return (
    <section id="main" aria-labelledby="operator-login" className="studio-gate">
      <Image src="/characters/combined.png" alt="" width={76} height={76} />
      <p className="studio-mark" style={{ color: "var(--studio-teal)", fontSize: "1.5rem", marginTop: "0.35rem" }}>
        طمّني
      </p>
      <h2 id="operator-login" className="mt-3 text-xl font-extrabold">
        دخول المشغّل
      </h2>
      <p className="studio-lede">هذه اللوحة لفريق العرض فقط. حساب ولي الأمر التجريبي لا يفتحها.</p>
      {sharedError && <ErrorNote>{sharedError}</ErrorNote>}
      {local && (
        <div className="mt-4 space-y-2 rounded-lg bg-[var(--studio-info-bg)] p-3 text-sm leading-6 text-[#194185]">
          <p>الوضع المحلي مفعّل: يمكن فتح اللوحة دون كتابة البريد.</p>
          {localError && <ErrorNote>{localError}</ErrorNote>}
          <button
            type="button"
            aria-disabled={busy || undefined}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              await onLocal();
              setBusy(false);
            }}
            className={`${secondaryButton} w-full`}
          >
            فتح اللوحة (وضع محلي)
          </button>
        </div>
      )}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="op-email" className={labelClass}>
            البريد
          </label>
          <input id="op-email" type="email" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} required />
        </div>
        <div>
          <label htmlFor="op-password" className={labelClass}>
            كلمة المرور
          </label>
          <input id="op-password" type="password" autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldClass} required />
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <button type="submit" aria-disabled={busy || undefined} className={`${primaryButton} w-full`}>
          {busy ? "جارٍ الدخول…" : "دخول المشغّل"}
        </button>
      </form>
    </section>
  );
}

function Studio({ onSignedOut }: { onSignedOut: () => void }) {
  const [view, setView] = useState<StudioView>(readView);
  const [data, setData] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; overview: Overview }>({
    state: "loading",
  });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => setView(readView());
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  const load = useCallback(async () => {
    setData({ state: "loading" });
    const r = await api<Overview>("/api/demo-control/overview");
    if (!r.ok) {
      if (r.status === 401 || r.status === 403) return onSignedOut();
      return setData({ state: "error", message: r.error });
    }
    setData({ state: "ready", overview: r.data });
    setSelected((s) => s ?? r.data.students[0]?.id ?? null);
  }, [onSignedOut]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const signOut = async () => {
    await api("/api/demo-control/session", { method: "DELETE" });
    onSignedOut();
  };

  const current = data.state === "ready" ? data.overview.students.find((s) => s.id === selected) : undefined;

  return (
    <div className="studio-shell studio-enter">
      <aside className="studio-rail" aria-label="تنقل استوديو الديمو">
        <div>
          <p className="studio-mark">طمّني</p>
          <span className="studio-badge">بيئة تجريبية</span>
        </div>
        <nav className="studio-nav">
          {views.map((item) => (
            <a key={item.id} href={item.href} aria-current={view === item.id ? "page" : undefined}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="studio-rail-foot">
          <a href="#manage" aria-current={view === "manage" ? "page" : undefined}>
            إدارة التجربة
          </a>
          <button type="button" onClick={signOut}>
            <LogoutIcon size={14} className="me-1 inline" />
            خروج المشغّل
          </button>
        </div>
      </aside>

      <div className="studio-main">
        <header className="studio-top">
          <div>
            <h1>استوديو تشغيل الديمو</h1>
            {data.state === "ready" && (
              <p className="studio-parent">
                ولي الأمر: <strong>{data.overview.parent?.name ?? "غير مرتبط"}</strong>
                {current ? ` · يعمل على ${current.firstName}` : ""}
              </p>
            )}
          </div>
          <a href="/welcome" target="_blank" rel="noopener" className="studio-open">
            فتح تجربة ولي الأمر
            <span className="sr-only"> (في تبويب جديد)</span>
          </a>
          {data.state === "ready" && (
            <div className="studio-students" role="group" aria-label="اختر الطالب">
              {data.overview.students.map((s) => {
                const active = s.id === selected;
                const tone = s.key === "nawaf" || s.firstName === "نواف" ? "nawaf" : "reem";
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(s.id)}
                    className="studio-chip"
                  >
                    <span className="studio-avatar" data-tone={tone} aria-hidden="true">
                      {s.firstName.slice(0, 1)}
                    </span>
                    <span>
                      <span className="studio-chip-name">{s.firstName}</span>
                      <span className="studio-chip-meta">
                        {s.grade}
                        {s.stage ? ` — ${s.stage}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <main id="main" className="studio-canvas">
          {data.state === "loading" && (
            <p role="status" className="text-sm text-[var(--studio-muted)]">
              جارٍ تحميل بيانات الديمو…
            </p>
          )}
          {data.state === "error" && (
            <div className="space-y-3">
              <ErrorNote>{data.message}</ErrorNote>
              <button type="button" onClick={load} className={secondaryButton}>
                إعادة المحاولة
              </button>
            </div>
          )}
          {data.state === "ready" && view === "guide" && <Guide />}
          {data.state === "ready" && selected && view !== "guide" && (
            <StudentPanel
              key={selected}
              studentId={selected}
              today={data.overview.today}
              view={view}
              onSignedOut={onSignedOut}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Guide() {
  return (
    <section aria-labelledby="guide-title" className="studio-panel studio-swap max-w-2xl">
      <div className="studio-empty" style={{ background: "transparent", padding: 0, marginBottom: "0.75rem" }}>
        <Image src="/characters/combined.png" alt="" width={72} height={72} />
        <div>
          <h2 id="guide-title">كيف يعمل العرض</h2>
          <p className="studio-lede">لولوة وتركي يبلّغان ولي الأمر حسب التفضيلات المحفوظة. التشغيل من هنا يدوي.</p>
        </div>
      </div>
      <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-6">
        <li>
          <strong>تقييم الموعد:</strong> عند حفظ الحدث نحسب من التفضيلات هل التحديث متوقف أو بانتظار موعد أو جاهز، بتوقيت الرياض.
        </li>
        <li>
          <strong>التشغيل اليدوي:</strong> «تشغيل التحديث الآن» يتجاوز الانتظار فقط، ويسجّل الموعد الأصلي. لا يتجاوز موضوعًا متوقفًا.
        </li>
        <li>
          <strong>الجدولة التلقائية:</strong> غير مفعّلة. لا يُرسل شيء في الخلفية عند حلول الموعد، ولا تُعاد المكالمات تلقائيًا.
        </li>
      </ul>
      <p className="studio-lede mt-4">
        <InfoIcon size={14} className="mb-0.5 inline" /> التسلسل دائمًا: حفظ الحدث، ثم المعاينة، ثم التشغيل — منفصلان.
      </p>
    </section>
  );
}
