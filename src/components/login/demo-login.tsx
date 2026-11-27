"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { parent } from "@/components/dashboard/data";
import { InfoIcon, UserIcon } from "@/components/dashboard/icons";
import { safeReturnPath, startDemoSession, useDemoSession } from "@/lib/demo-session";

export function DemoLogin() {
  const router = useRouter();
  const returnPath = safeReturnPath(useSearchParams().get("next"));
  const next = returnPath.replace(/^\/(?=\?|$)/, "/tammeni");
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
      <section aria-labelledby="login-title" className="on-board">
        <div className="mx-auto max-w-[760px] px-4 pt-8 pb-20 sm:px-6 sm:pt-12 sm:pb-24">
          <h1 id="login-title" className="text-[2.25rem] leading-[1.25] text-chalk sm:text-[3rem]">
            دخول تجريبي
          </h1>
          <p className="mt-4 max-w-[42rem] text-[1.0625rem] leading-8 text-chalk-soft">
            ادخل إلى النموذج باسم ولي أمر وهمي. لا نطلب كلمة مرور ولا أي بيانات شخصية.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-12 w-full max-w-[760px] px-4 pb-12 sm:-mt-14 sm:px-6">
        <section aria-labelledby="login-as" className="sheet p-5 sm:p-7">
          <h2 id="login-as" className="sr-only">ستدخل باسم</h2>
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <UserIcon size={22} className="mt-1 shrink-0 text-ink-soft" />
              <div className="min-w-0">
                <p className="font-display text-[1.25rem] leading-snug font-semibold text-ink">{parent.name}</p>
                <p className="mt-1 text-[0.9375rem] leading-7 text-ink-soft">
                  {parent.role} لسما وأحمد — بيانات وهمية
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={enter}
              aria-disabled={entering || undefined}
              className="btn-primary w-full text-[1.0625rem] aria-disabled:cursor-wait"
            >
              {entering ? "جارٍ الدخول…" : "دخول"}
            </button>
            {failed && (
              <p role="alert" className="notice notice-danger">
                تعذّر بدء الدخول التجريبي. تأكد من اتصالك بالإنترنت، ثم حاول مرة أخرى.
              </p>
            )}
          </div>
        </section>

        <ul className="mt-5 space-y-2 text-[0.875rem] leading-6 text-ink-soft">
          {[
            "هذا ليس تسجيل دخول حقيقيًا، ولا يمنح وصولًا إلى أي بيانات حقيقية.",
            "اختياراتك تنحفظ في هذا الجهاز فقط، وكل شخص يبدأ تجربته من جديد.",
          ].map((note) => (
            <li key={note} className="flex gap-3">
              <InfoIcon size={18} className="mt-1 shrink-0 text-faint" />
              {note}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
