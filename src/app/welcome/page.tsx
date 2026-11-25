import type { Metadata } from "next";
import Image from "next/image";
import { TammeniExperience } from "@/components/brand/experience";
import { Suspense } from "react";
import { students } from "@/components/dashboard/data";
import { AttendanceIcon, ExamIcon, GradesIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { DemoNotice, Footer } from "@/components/dashboard/page-shell";
import { BrandHeader } from "@/components/dashboard/site-header";
import { WelcomeActions, WelcomeActionsFallback } from "@/components/welcome/welcome-actions";
import { WelcomeCharacter } from "@/components/welcome/welcome-character";
import "@/components/welcome/welcome.css";

export const metadata: Metadata = {
  title: "طمّني | نسخة تجريبية",
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، بالطريقة والوقت اللي يناسبك. نموذج تعليمي ببيانات خيالية.",
  // Link previews also reach English readers, so they carry a short English line.
  openGraph: {
    title: "طمّني Tammeni — school news by call or text",
    description: "Parents choose what school news reaches them, when, and how. Arabic demo with fictional data.",
  },
  twitter: {
    title: "طمّني Tammeni — school news by call or text",
    description: "Parents choose what school news reaches them, when, and how. Arabic demo with fictional data.",
  },
};

// The examples are built from ريم's fictional record (this page is shown before sign-in, so it uses the
// bundled copy), in the same words the call and the message use, so they promise nothing new.
const reem = students.find((s) => s.id === "reem")!;
const exam = reem.exams[0];
const callExample = `مرحبا، معك لولوة من طمّني. تذكير بسيط: ${reem.firstName} عندها اختبار ${exam.subject} يوم ${exam.day}، ${exam.period}، في المدرسة.`;
const messageExample = { heading: `طمّني | ${reem.name}`, body: `${exam.subject}: ${exam.kind} — ${exam.day} ${exam.date}، ${exam.period}.` };

const topicsList = [
  { Icon: AttendanceIcon, title: "الحضور والغياب", detail: "أول ما يُسجَّل، أو ملخص آخر اليوم أو الأسبوع." },
  { Icon: ExamIcon, title: "الاختبارات", detail: "تذكير قبلها بيوم أو أسبوع أو بالعدد اللي تختاره." },
  { Icon: GradesIcon, title: "الدرجات", detail: "أول ما تُنشر درجة، أو ملخص لكل المواد مرة في الشهر." },
];

export default function WelcomePage() {
  return (
    <TammeniExperience>
      <DemoNotice />
      <BrandHeader />

      <main id="main" className="flex-1">
        <section aria-labelledby="welcome-title">
          <div className="mx-auto grid max-w-[1100px] items-center gap-8 px-4 pt-8 pb-14 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:pt-14 lg:pb-20">
            <div className="min-w-0 lg:col-span-7">
              <h1
                id="welcome-title"
                className="welcome-rise welcome-after1 text-[2.125rem] leading-[1.25] font-bold tracking-tight text-balance sm:text-[2.75rem] lg:text-[3.25rem]"
              >
                أخبار أبنائك توصلك باتصال أو رسالة
              </h1>
              <p className="welcome-rise welcome-after2 mt-5 max-w-[46ch] text-[1.1875rem] leading-9 text-ink-soft">
                تختار وش يهمك من الحضور والاختبارات والدرجات، والوقت اللي يناسبك، وكيف. بدون ما تدخل المنصة كل يوم.
              </p>
              <Suspense fallback={<WelcomeActionsFallback />}>
                <WelcomeActions />
              </Suspense>
            </div>
            <div className="lg:col-span-5">
              <WelcomeCharacter />
            </div>
          </div>
        </section>

        <section aria-labelledby="examples-title" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-[1100px] px-4 py-14 sm:px-6 lg:py-20">
            <h2 id="examples-title" className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">
              كذا يوصلك الخبر
            </h2>
            <p className="mt-2 max-w-[60ch] text-[1.0625rem] leading-8 text-ink-soft">
              مثال من بيانات ريم الخيالية: تذكير باختبار {exam.subject}، مرة باتصال ومرة برسالة.
            </p>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              <figure className="tone flex flex-col p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <Image src="/characters/combined.png" alt="" width={56} height={56} className="size-14 rounded-full bg-surface object-contain" />
                  <div>
                    <p className="font-semibold">لولوة من طمّني</p>
                    <p className="flex items-center gap-1.5 text-[0.9375rem] text-ink-soft">
                      <PhoneIcon size={16} />
                      اتصال صوتي
                    </p>
                  </div>
                </div>
                <blockquote className="mt-5 rounded-2xl rounded-ss-md bg-surface px-4 py-3.5 text-[1.0625rem] leading-8">{callExample}</blockquote>
                <figcaption className="mt-4 text-[0.9375rem] leading-7 text-ink-soft">
                  المكالمة حوار: تقدر تسأل لولوة عن حضور ريم أو درجاتها، وترد عليك من سجلها.
                </figcaption>
              </figure>

              <figure className="tone flex flex-col p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-14 place-items-center rounded-full bg-surface text-brand" aria-hidden="true">
                    <MessageIcon size={26} />
                  </span>
                  <div>
                    <p className="font-semibold">طمّني</p>
                    <p className="flex items-center gap-1.5 text-[0.9375rem] text-ink-soft">
                      <MessageIcon size={16} />
                      رسالة نصية
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl rounded-se-md bg-surface px-4 py-3.5 text-[1.0625rem] leading-8">
                  <p className="font-semibold">{messageExample.heading}</p>
                  <p>{messageExample.body}</p>
                </div>
                <figcaption className="mt-4 text-[0.9375rem] leading-7 text-ink-soft">رسالة قصيرة فيها الخبر كامل، تقراها متى ما ناسبك.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section aria-labelledby="topics-title">
          <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:py-20">
            <div className="lg:col-span-4">
              <h2 id="topics-title" className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">
                أنت تختار وش يوصلك
              </h2>
              <p className="mt-2 text-[1.0625rem] leading-8 text-ink-soft">لكل ابن اختياراته، ولكل نوع وقته وطريقته. وتقدر توقف أي نوع.</p>
            </div>
            <ul className="divide-y divide-line border-y border-line lg:col-span-8">
              {topicsList.map(({ Icon, title, detail }) => (
                <li key={title} className="flex gap-4 py-5">
                  <Icon size={26} className="mt-0.5 shrink-0 text-brand" />
                  <div>
                    <p className="text-[1.125rem] font-semibold">{title}</p>
                    <p className="mt-0.5 leading-7 text-ink-soft">{detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Footer />
    </TammeniExperience>
  );
}
