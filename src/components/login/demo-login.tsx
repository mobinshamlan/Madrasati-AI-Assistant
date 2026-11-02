"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { parent } from "@/components/dashboard/data";
import { InfoIcon, UserIcon } from "@/components/dashboard/icons";
import { SectionTab } from "@/components/madrasati/ui";
import { safeReturnPath, startDemoSession, useDemoSession } from "@/lib/demo-session";

export function DemoLogin() {
  const router = useRouter();
  const next = safeReturnPath(useSearchParams().get("next"));
  const status = useDemoSession();
  const [failed, setFailed] = useState(false);

  // Already inside (another tab, or a refresh): go straight on.
  useEffect(() => {
    if (status === "signed-in") router.replace(next);
  }, [status, next, router]);

  const [entering, setEntering] = useState(false);
  const enter = async () => {
    if (entering) return;
    setEntering(true);
    setFailed(false);
    if (await startDemoSession()) {
      router.replace(next);
    } else {
      setEntering(false);
      setFailed(true);
    }
  };

  return (
    <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
      <section aria-labelledby="login-title" className="bg-mint-200">
        <div className="mx-auto max-w-xl px-4 pt-8 pb-10">
          <h1 id="login-title" className="text-3xl leading-tight font-extrabold text-ink">
            دخول تجريبي
          </h1>
          <p className="mt-3 text-lg leading-8 text-ink">
            ادخل إلى النموذج باسم ولي أمر خيالي. لا نطلب كلمة مرور ولا أي بيانات شخصية.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-xl space-y-6 px-4 py-8 text-lg">
        <section aria-labelledby="login-as">
          <SectionTab id="login-as" title="ستدخل باسم" size="lg" />
          <div className="space-y-6 rounded-b-xl border border-t-0 border-line bg-white p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-mint-200 text-brand-700">
                <UserIcon size={30} />
              </span>
              <div>
                <p className="text-xl font-bold text-ink">{parent.name}</p>
                <p className="text-ink">
                  {parent.role} لريم ونواف — بيانات خيالية
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={enter}
              aria-disabled={entering || undefined}
              className="btn-primary w-full text-xl aria-disabled:cursor-wait"
            >
              {entering ? "جارٍ الدخول…" : "دخول"}
            </button>
            {failed && (
              <p role="alert" className="rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]">
                تعذّر بدء الدخول التجريبي. تأكد من اتصالك بالإنترنت، ثم حاول مرة أخرى.
              </p>
            )}
          </div>
        </section>

        <ul className="space-y-3 text-base leading-7 text-ink">
          {[
            "هذا ليس تسجيل دخول حقيقيًا، ولا يمنح وصولًا إلى أي بيانات حقيقية.",
            "تبقى تفضيلات طمّني محفوظة في الحساب التجريبي حتى بعد الخروج من هذه الجلسة.",
          ].map((note) => (
            <li key={note} className="flex gap-3">
              <InfoIcon size={22} className="mt-0.5 shrink-0 text-brand-700" />
              {note}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
