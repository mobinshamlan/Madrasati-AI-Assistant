"use client";

import { useCallback, useEffect, useState } from "react";
import { InfoIcon, LogoutIcon, UserIcon } from "@/components/dashboard/icons";
import { api, ErrorNote, fieldClass, labelClass, primaryButton, secondaryButton } from "./shared";
import { StudentPanel } from "./student-panel";

type Overview = {
  parent: { name: string } | null;
  students: { id: string; key: string; name: string; firstName: string; grade: string; stage: string | null; school: string }[];
  today: string;
};

export function DemoControl() {
  const [session, setSession] = useState<"checking" | "in" | "out">("checking");
  // Local demo mode (decided by the server per request): the operator account is signed in without the form.
  const [local, setLocal] = useState(false);
  const [localError, setLocalError] = useState("");
  const signInLocally = useCallback(async () => {
    setLocalError("");
    const r = await api("/api/demo-control/session/local", { method: "POST" });
    if (r.ok) setSession("in");
    else setLocalError(r.error);
    return r.ok;
  }, []);
  const check = useCallback(async () => {
    const r = await api<{ signedIn: boolean; local?: boolean }>("/api/demo-control/session");
    const isLocal = r.ok && r.data.local === true;
    setLocal(isLocal);
    if (r.ok && r.data.signedIn) return setSession("in");
    if (isLocal && (await signInLocally())) return;
    setSession("out");
  }, [signInLocally]);
  useEffect(() => {
    // Ask the server once on load whether the operator cookie holds a valid operator session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void check();
  }, [check]);

  if (session === "checking") return <p role="status" className="py-16 text-center text-lg text-ink-soft">جارٍ التحقق من جلسة المشغّل…</p>;
  if (session === "out") return <OperatorLogin onSignedIn={() => setSession("in")} local={local} localError={localError} onLocal={signInLocally} />;
  return <Console onSignedOut={() => setSession("out")} />;
}

function OperatorLogin({ onSignedIn, local, localError, onLocal }: { onSignedIn: () => void; local: boolean; localError: string; onLocal: () => Promise<boolean> }) {
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
    <section aria-labelledby="operator-login" className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6">
      <h2 id="operator-login" className="text-2xl font-extrabold text-ink">
        دخول المشغّل
      </h2>
      <p className="mt-2 text-base leading-7 text-ink">
        هذه اللوحة لمن يدير العرض فقط، بحساب له صلاحية المشغّل. حساب ولي الأمر التجريبي لا يفتحها.
      </p>
      {local && (
        <div className="mt-5 space-y-3 rounded-xl border-2 border-[#b2ddff] bg-[#eff8ff] p-4">
          <p className="text-base leading-7 text-[#194185]">الوضع المحلي مفعّل على هذا الجهاز: يمكن فتح اللوحة بحساب المشغّل دون كتابة البريد وكلمة المرور.</p>
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
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="op-email" className={labelClass}>البريد</label>
          <input id="op-email" type="email" autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} required />
        </div>
        <div>
          <label htmlFor="op-password" className={labelClass}>كلمة المرور</label>
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

function Console({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; overview: Overview }>({ state: "loading" });
  const [selected, setSelected] = useState<string | null>(null);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/welcome" target="_blank" rel="noopener" className={secondaryButton}>
          فتح تجربة ولي الأمر
          <span className="sr-only"> (في تبويب جديد)</span>
        </a>
        <button type="button" onClick={signOut} className="inline-flex min-h-12 items-center gap-2 rounded-lg px-4 font-bold text-brand-700 underline underline-offset-4">
          <LogoutIcon size={20} />
          خروج المشغّل
        </button>
      </div>

      <TimingExplainer />

      {data.state === "loading" && <p role="status" className="text-lg text-ink-soft">جارٍ تحميل بيانات الديمو…</p>}
      {data.state === "error" && (
        <div className="space-y-3">
          <ErrorNote>{data.message}</ErrorNote>
          <button type="button" onClick={load} className={secondaryButton}>إعادة المحاولة</button>
        </div>
      )}
      {data.state === "ready" && (
        <>
          <section aria-labelledby="parent-card" className="rounded-xl border border-line bg-white p-5">
            <h2 id="parent-card" className="sr-only">ولي الأمر</h2>
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-mint-200 text-brand-700"><UserIcon size={28} /></span>
              <div>
                <p className="text-xl font-bold text-ink">{data.overview.parent?.name ?? "لا يوجد ولي أمر مرتبط"}</p>
                <p className="text-base text-ink">ولي أمر تجريبي — الأبناء المرتبطون: {data.overview.students.map((s) => s.firstName).join(" و")}</p>
              </div>
            </div>
          </section>

          <fieldset>
            <legend className="mb-3 text-xl font-bold text-ink">اختر الطالب</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.overview.students.map((s) => {
                const active = s.id === selected;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelected(s.id)}
                    className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-start transition-colors ${
                      active ? "border-brand-600 bg-mint-100" : "border-[#9da4ae] bg-white hover:border-brand-500 hover:bg-mint-50"
                    }`}
                  >
                    <span>
                      <span className="block text-lg font-bold text-ink">{s.name}</span>
                      <span className="block text-base text-ink">{s.grade}{s.stage ? ` — ${s.stage}` : ""}</span>
                    </span>
                    {active && <span className="rounded-full bg-brand-600 px-3 py-1 text-sm font-bold text-white">المختار</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {selected && <StudentPanel key={selected} studentId={selected} today={data.overview.today} onSignedOut={onSignedOut} />}
        </>
      )}
    </div>
  );
}

/** The three things that are easy to confuse, said plainly. */
function TimingExplainer() {
  return (
    <section aria-labelledby="timing-help" className="rounded-xl border-2 border-[#b2ddff] bg-[#eff8ff] p-5 leading-8 text-[#194185]">
      <h2 id="timing-help" className="flex items-center gap-2 text-xl font-bold">
        <InfoIcon size={22} />
        كيف تعمل المواعيد في هذه اللوحة
      </h2>
      <ul className="mt-2 list-disc space-y-1 ps-8">
        <li><strong>تقييم الموعد:</strong> عند حفظ الحدث نحسب من تفضيلات ولي الأمر المحفوظة هل التحديث متوقف أو بانتظار موعد أو جاهز، بتوقيت الرياض.</li>
        <li><strong>التشغيل اليدوي للديمو:</strong> «تشغيل التحديث الآن» يتجاوز الانتظار فقط، ويسجل الموعد الأصلي. لا يتجاوز موضوعًا متوقفًا.</li>
        <li><strong>الجدولة التلقائية:</strong> غير مفعّلة في هذه النسخة. لا يُرسل شيء في الخلفية عند حلول الموعد، ولا تُعاد المكالمات تلقائيًا.</li>
      </ul>
    </section>
  );
}
