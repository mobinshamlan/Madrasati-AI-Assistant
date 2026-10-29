import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { DemoLabel } from "@/components/assistant/summary";
import { students } from "@/components/dashboard/data";
import { MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { DemoNotice, Footer } from "@/components/dashboard/page-shell";
import { WelcomeActions, WelcomeActionsFallback } from "@/components/welcome/welcome-actions";
import { WelcomeCharacter } from "@/components/welcome/welcome-character";
import "@/components/welcome/welcome.css";

export const metadata: Metadata = {
  title: "طمّني | نسخة تجريبية",
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، بالطريقة والوقت اللي يناسبك. نموذج تعليمي ببيانات خيالية.",
};

const steps = [
  { title: "اختر ابنك أو ابنتك", detail: "في هذه النسخة: ريم أو نواف، ببيانات خيالية." },
  { title: "حدد التحديثات المناسبة", detail: "الحضور والغياب، الاختبارات، الدرجات." },
  { title: "اختر طريقة ووقت التواصل", detail: "اتصال أو رسالة، في الوقت الذي يناسبك." },
];

// The examples are built from ريم's fictional record (this page is shown before sign-in, so it uses the
// bundled copy), in the same words the call and the message use, so they promise nothing new.
const reem = students.find((s) => s.id === "reem")!;
const exam = reem.exams[0];
const callExample = `مرحبا، معك لولوة من طمّني. تذكير بسيط: ${reem.firstName} عندها اختبار ${exam.subject} يوم ${exam.day}، ${exam.period}، في المدرسة.`;
const messageExample = { heading: `طمّني | ${reem.name}`, body: `${exam.subject}: ${exam.kind} — ${exam.day} ${exam.date}، ${exam.period}.` };

export default function WelcomePage() {
  return (
    <>
      <DemoNotice />
      <header className="bg-mint-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 lg:h-[72px] lg:px-6">
          <p className="text-3xl leading-none font-extrabold text-brand-800">طمّني</p>
          <DemoLabel />
        </div>
      </header>

      <main id="main" className="flex-1">
        <section aria-labelledby="welcome-title" className="bg-mint-200">
          <div className="mx-auto grid max-w-6xl items-center gap-6 px-4 pt-6 pb-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:px-6 lg:pt-12 lg:pb-20">
            <WelcomeCharacter />
            <div>
              <h1
                id="welcome-title"
                className="welcome-rise welcome-after1 text-[34px] leading-[1.3] font-extrabold text-balance text-ink sm:text-5xl sm:leading-[1.25] lg:text-[56px]"
              >
                أخبار أبنائك توصلك باتصال أو رسالة
              </h1>
              <p className="welcome-rise welcome-after2 mt-4 max-w-xl text-xl leading-9 text-ink">
                بالطريقة والوقت اللي يناسبك. تختار ما يهمك من الحضور والاختبارات والدرجات، دون الحاجة إلى التنقل في المنصة.
              </p>
              <Suspense fallback={<WelcomeActionsFallback />}>
                <WelcomeActions />
              </Suspense>
            </div>
          </div>
        </section>

        <section aria-labelledby="steps-title" className="bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
            <h2 id="steps-title" className="text-3xl font-extrabold text-ink">
              ثلاث خطوات وتبدأ
            </h2>
            <ol className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
              {steps.map((step, i) => (
                <StepItem key={step.title} step={step} last={i === steps.length - 1} />
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="examples-title" className="bg-mint-100">
          <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
            <h2 id="examples-title" className="text-3xl font-extrabold text-ink">
              كيف توصلك الأخبار
            </h2>
            <p className="mt-3 text-lg leading-8 text-ink">أمثلة توضيحية ببيانات خيالية.</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <figure className="rounded-xl bg-white p-5 sm:p-6">
                <figcaption className="flex items-center gap-2 text-xl font-bold text-brand-800">
                  <PhoneIcon size={26} className="text-brand-700" />
                  باتصال
                </figcaption>
                <div className="mt-4 flex items-start gap-3">
                  <Image src="/characters/girl.png" alt="" width={64} height={64} className="size-16 shrink-0" />
                  <blockquote className="rounded-2xl rounded-ss-sm bg-mint-100 px-4 py-3 text-lg leading-8 text-ink">
                    {callExample}
                  </blockquote>
                </div>
              </figure>
              <figure className="rounded-xl bg-white p-5 sm:p-6">
                <figcaption className="flex items-center gap-2 text-xl font-bold text-brand-800">
                  <MessageIcon size={26} className="text-brand-700" />
                  برسالة
                </figcaption>
                <div className="mt-4 rounded-2xl bg-mint-100 px-4 py-3 text-lg leading-8 text-ink">
                  <p className="font-bold">{messageExample.heading}</p>
                  <p>{messageExample.body}</p>
                </div>
              </figure>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function StepItem({ step, last }: { step: (typeof steps)[number]; last: boolean }) {
  return (
    <>
      <li className="rounded-xl bg-mint-100 p-5">
        <p className="text-xl font-bold text-ink">{step.title}</p>
        <p className="mt-1 text-base leading-7 text-ink">{step.detail}</p>
      </li>
      {!last && (
        // The order is shown by position; the arrow points along the reading direction.
        <li aria-hidden="true" className="flex items-center justify-center text-3xl leading-none text-brand-600">
          <span className="lg:hidden">↓</span>
          <span className="hidden lg:inline">←</span>
        </li>
      )}
    </>
  );
}
