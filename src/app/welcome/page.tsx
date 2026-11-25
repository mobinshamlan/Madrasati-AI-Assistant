import type { Metadata } from "next";
import Image from "next/image";
import { TammeniExperience } from "@/components/brand/experience";
import { Suspense } from "react";
import { students } from "@/components/dashboard/data";
import { AttendanceIcon, BellIcon, ExamIcon, GradesIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { DemoNotice, Footer } from "@/components/dashboard/page-shell";
import { BrandHeader } from "@/components/dashboard/site-header";
import { WelcomeActions, WelcomeActionsFallback } from "@/components/welcome/welcome-actions";
import { WelcomeCharacter } from "@/components/welcome/welcome-character";
import "@/components/welcome/welcome.css";

export const metadata: Metadata = {
  title: "طمّني | نسخة تجريبية",
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، بالطريقة والوقت اللي يناسبك. نموذج تعليمي ببيانات خيالية.",
  // Link previews also reach English readers, so they carry a short English line. Setting them here
  // replaces the layout's preview fields, so the image and card type are repeated.
  openGraph: {
    title: "طمّني Tammeni — school news by call or text",
    description: "Parents choose what school news reaches them, when, and how. Arabic demo with fictional data.",
    siteName: "طمّني",
    locale: "ar_SA",
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Tammeni (طمّني): school news reaches parents by call or text" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "طمّني Tammeni — school news by call or text",
    description: "Parents choose what school news reaches them, when, and how. Arabic demo with fictional data.",
    images: ["/twitter-image.png"],
  },
};

// The examples are built from ريم's fictional record (this page is shown before sign-in, so it uses the
// bundled copy), in the same words the call and the message use, so they promise nothing new.
const reem = students.find((s) => s.id === "reem")!;
const exam = reem.exams[0];
const callExample = `مرحبا، معك لولوة من طمّني. تذكير بسيط: ${reem.firstName} عندها اختبار ${exam.subject} يوم ${exam.day}، ${exam.period}، في المدرسة.`;
const messageExample = { heading: `طمّني | ${reem.name}`, body: `${exam.subject}: ${exam.kind} — ${exam.day} ${exam.date}، ${exam.period}.` };

// A school day with the suggested settings: attendance summary by call at 2:00 pm, an exam reminder the
// evening before at 6:00 pm. Labelled as an example on the page.
const day = [
  { time: "7:30 ص", title: "المدرسة تسجّل الحضور", detail: "ما يوصلك شيء الحين." },
  { time: "2:00 م", title: "لولوة تتصل عليك", detail: "ملخص حضور اليوم، بعد نهاية الدوام." },
  { time: "6:00 م", title: "تذكير باختبار بكرة", detail: "باتصال أو رسالة، مثل ما تختار." },
];

const topicsList = [
  { Icon: AttendanceIcon, title: "الحضور والغياب", detail: "أول ما يُسجَّل، أو ملخص آخر اليوم أو الأسبوع." },
  { Icon: ExamIcon, title: "الاختبارات", detail: "تذكير قبلها بيوم أو أسبوع أو بالعدد اللي تختاره." },
  { Icon: GradesIcon, title: "الدرجات", detail: "أول ما تُنشر درجة، أو ملخص مرة في الشهر." },
];

const container = "mx-auto w-full max-w-[1100px] px-4 sm:px-6";

export default function WelcomePage() {
  return (
    <TammeniExperience>
      <DemoNotice />
      <BrandHeader />

      <main id="main" className="flex-1">
        <section aria-labelledby="welcome-title" className="on-board overflow-hidden">
          <div className={`${container} grid items-center gap-10 pt-10 pb-16 lg:grid-cols-12 lg:gap-8 lg:pt-16 lg:pb-24`}>
            <div className="min-w-0 lg:col-span-7">
              <h1
                id="welcome-title"
                className="welcome-rise text-[2.75rem] leading-[1.2] text-chalk sm:text-[3.75rem] lg:text-[4.5rem]"
              >
                وش صار مع عيالك اليوم؟
              </h1>
              <p className="welcome-rise welcome-after1 mt-5 max-w-[40ch] text-[1.1875rem] leading-9 text-chalk-soft sm:text-[1.3125rem]">
                طمّني يوصلك خبر الحضور والاختبارات والدرجات، باتصال أو رسالة، في الوقت اللي تختاره.
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

        <section aria-labelledby="day-title">
          <div className={`${container} py-16 lg:py-24`}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <h2 id="day-title" className="text-[2rem] leading-tight sm:text-[2.5rem]">
                يوم دراسي مع طمّني
              </h2>
              <p className="text-[0.9375rem] text-faint">مثال توضيحي من بيانات ريم الخيالية</p>
            </div>

            <ol className="welcome-day mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {day.map((stop, i) => (
                <li key={stop.time} className="relative ps-8 md:ps-0 md:pt-8">
                  <span aria-hidden="true" className="welcome-day-dot" data-lit={i > 0 || undefined} />
                  <p className="num text-[0.9375rem] font-semibold text-faint">
                    <bdi>{stop.time}</bdi>
                  </p>
                  <p className="mt-1 font-display text-[1.25rem] leading-snug font-semibold">{stop.title}</p>
                  <p className="mt-1 leading-7 text-ink-soft">{stop.detail}</p>
                </li>
              ))}
            </ol>

            <div id="examples" className="mt-14 grid scroll-mt-6 gap-5 lg:grid-cols-2">
              <figure className="tone flex flex-col p-6 sm:p-7">
                <figcaption className="flex items-center gap-3">
                  <Image src="/characters/combined.png" alt="" width={52} height={52} className="size-13 rounded-full bg-surface object-contain" />
                  <span>
                    <span className="block font-semibold">لولوة من طمّني</span>
                    <span className="flex items-center gap-1.5 text-[0.9375rem] text-ink-soft">
                      <PhoneIcon size={16} />
                      اتصال صوتي
                    </span>
                  </span>
                </figcaption>
                <blockquote className="mt-5 rounded-2xl rounded-ss-md bg-surface px-5 py-4 text-[1.0625rem] leading-8">{callExample}</blockquote>
                <p className="mt-4 text-[0.9375rem] leading-7 text-ink-soft">وتقدر تسألها عن حضور ريم أو درجاتها، وترد عليك من سجلها.</p>
              </figure>

              <figure className="tone flex flex-col p-6 sm:p-7">
                <figcaption className="flex items-center gap-3">
                  <span className="grid size-13 place-items-center rounded-full bg-surface text-board" aria-hidden="true">
                    <MessageIcon size={24} />
                  </span>
                  <span>
                    <span className="block font-semibold">طمّني</span>
                    <span className="flex items-center gap-1.5 text-[0.9375rem] text-ink-soft">
                      <MessageIcon size={16} />
                      رسالة نصية
                    </span>
                  </span>
                </figcaption>
                <div className="note mt-5 text-[1.0625rem] leading-8 !shadow-none">
                  <BellIcon size={20} className="note-bell" />
                  <p className="font-semibold">{messageExample.heading}</p>
                  <p>{messageExample.body}</p>
                </div>
                <p className="mt-4 text-[0.9375rem] leading-7 text-ink-soft">رسالة قصيرة فيها الخبر كامل، تقراها متى ما ناسبك.</p>
              </figure>
            </div>
          </div>
        </section>

        <section aria-labelledby="topics-title" className="bg-panel">
          <div className={`${container} grid gap-8 py-16 lg:grid-cols-12 lg:py-24`}>
            <div className="lg:col-span-5">
              <h2 id="topics-title" className="text-[2rem] leading-tight sm:text-[2.5rem]">
                أنت تختار وش يوصلك
              </h2>
              <p className="mt-3 max-w-[36ch] text-[1.0625rem] leading-8 text-ink-soft">لكل واحد من عيالك اختياراته، ولكل نوع وقته وطريقته. وتقدر توقف أي نوع.</p>
            </div>
            <ul className="divide-y divide-line lg:col-span-7">
              {topicsList.map(({ Icon, title, detail }) => (
                <li key={title} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <Icon size={26} className="mt-1 shrink-0 text-board-line" />
                  <div>
                    <p className="font-display text-[1.25rem] font-semibold">{title}</p>
                    <p className="mt-1 leading-7 text-ink-soft">{detail}</p>
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
