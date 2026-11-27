import type { Metadata } from "next";
import { TimeText } from "@/components/dashboard/time-icons";
import { Suspense } from "react";
import { TammeniExperience } from "@/components/brand/experience";
import { MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { Footer } from "@/components/dashboard/page-shell";
import { WelcomeBar } from "@/components/welcome/welcome-bar";
import { alerts, family, methodLabel } from "@/components/welcome/example";
import { FlowLine } from "@/components/welcome/flow-line";
import { SchoolDay } from "@/components/welcome/school-day";
import { StartAtTop } from "@/components/welcome/start-at-top";
import { WelcomeActions, WelcomeActionsFallback } from "@/components/welcome/welcome-actions";
import { WelcomeCharacter } from "@/components/welcome/welcome-character";
import "@/components/welcome/welcome.css";

const preview = {
  title: "طمّنـــي Tammeni — school news by call or text",
  description: "Parents choose what school news reaches them, when, and how. Arabic demo with fictional data.",
};

export const metadata: Metadata = {
  title: "طمّنـــي | نسخة تجريبية",
  description: "أخبار أبنائك في المدرسة توصلك باتصال أو رسالة، بالطريقة والوقت اللي يناسبك. نموذج تجريبي ببيانات وهمية.",
  // Link previews also reach English readers, so they carry a short English line. Setting them here
  // replaces the layout's preview fields, so the image and card type are repeated.
  openGraph: {
    ...preview,
    siteName: "طمّنـــي",
    locale: "ar_SA",
    type: "website",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "Tammeni (طمّني): school news reaches parents by call or text" }],
  },
  twitter: { card: "summary_large_image", ...preview, images: ["/twitter-image.png"] },
};

const container = "mx-auto w-full max-w-[1100px] px-4 sm:px-6";
const heading = "text-[1.75rem] leading-tight sm:text-[2.5rem]";
const intro = "mt-3 text-[1.0625rem] leading-8 text-ink-soft lg:text-lg";

const stepTitle = "text-[clamp(1.3125rem,6.4vw,1.75rem)] sm:text-[2.5rem]";
// For the long title: it stays on one line, so its size follows the room beside the walk-through's line
// (the text is about 14.8 times as wide as its font size).
const oneLineTitle = "whitespace-nowrap text-[clamp(0.9375rem,calc((100vw-4.5rem)/14.9),1.75rem)] sm:text-[min(2.5rem,calc((100vw-7rem)/14.9))]";

/** A section title with its number sitting on the walk-through's line. */
function StepHeading({ n, id, children, size = stepTitle }: { n: number; id: string; children: React.ReactNode; size?: string }) {
  return (
    <div className="relative">
      <span data-step-dot aria-hidden="true" className="welcome-flow-dot num">
        {n}
      </span>
      <p className="sr-only">الخطوة {n} من 3</p>
      <h2 id={id} className={`leading-snug ${size}`}>
        {children}
      </h2>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <TammeniExperience>
      <StartAtTop />
      <WelcomeBar />

      <main id="main" className="flex-1">
        {/* On phones the words have the whole width and the robot stands below them, on the edge of the green field; wider screens put it beside them. */}
        <section aria-labelledby="welcome-title" className="on-board overflow-hidden">
          <div className={`${container} grid items-center gap-4 pt-8 pb-6 sm:grid-cols-12 sm:gap-8 sm:pt-12 sm:pb-16 lg:pt-16 lg:pb-24`}>
            <div className="min-w-0 sm:col-span-7">
              <h1 id="welcome-title" className="welcome-rise text-[clamp(2.25rem,12vw,3.25rem)] leading-[1.3] text-chalk lg:text-[4.5rem] lg:leading-[1.2]">
                <span className="block">وش صار مع</span>
                <span className="block text-bell-light">عيالك اليوم؟</span>
              </h1>
              <p className="welcome-rise welcome-after1 mt-4 max-w-[34ch] text-[1.125rem] leading-8 text-chalk-soft sm:text-[1.25rem] sm:leading-9">
                طمّنـــي يبقيك على اطلاع بكل جديد عن الحضور والاختبارات والدرجات، مع إمكانية اختيار وسيلة التنبيه، سواء مكالمة أو رسالة، وتحديد موعد وصوله.
              </p>
              <div className="welcome-rise welcome-after2 mt-7">
                <a href="#how" className="btn-primary mx-auto flex min-h-14 w-full max-w-[340px] px-9 text-[1.0625rem] sm:mx-0 sm:inline-flex sm:w-auto">
                  كيف يوصلك الخبر؟
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </a>
              </div>
            </div>
            <div className="justify-self-start sm:col-span-5 sm:justify-self-end">
              <WelcomeCharacter />
            </div>
          </div>
        </section>

        {/* The walk-through, in order: the example family, how its parent sets the alerts, then one day of them
            arriving. One line runs down their side and fills as the visitor reads. */}
        <FlowLine>
        <section id="how" aria-labelledby="how-title" className="scroll-mt-4">
          <div className="pt-10 pb-8 lg:pt-20 lg:pb-12">
            <StepHeading n={1} id="how-title">
              كيف يوصلك الخبر؟
            </StepHeading>
            <p className={intro}>تعرّف على تجربة توضح لك كيف تعمل الخدمة.</p>
            <p className="mt-6 font-semibold">في هذا المثال، عندك طفلان:</p>
            {/* Each child as a school ID card, hanging from its slot. */}
            <ul className="mt-3 grid grid-cols-2 gap-3 md:max-w-[36rem] md:gap-6 lg:max-w-none">
              {family.map(({ name, grade, school, tone }) => (
                <li key={name} className="on-board flex flex-col items-center rounded-[1.125rem] px-2 pt-2.5 pb-3.5 text-center">
                  <span aria-hidden="true" className="h-1.5 w-9 rounded-full bg-ground" />
                  <span aria-hidden="true" className="avatar mt-3 !size-14 !text-[1.5rem]" data-tone={tone}>
                    {name.slice(0, 1)}
                  </span>
                  <span className="mt-2 font-display text-[1.25rem] font-semibold">{name}</span>
                  <span className="text-[0.8125rem] leading-6 text-chalk-soft lg:text-sm">{grade}</span>
                  <span className="mt-2.5 w-[calc(100%-0.5rem)] border-t border-dashed border-board-line pt-2 text-[0.75rem] leading-5 text-bell-light lg:text-sm">{school}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="choices" aria-labelledby="choices-title" className="scroll-mt-4">
          <div className="pt-8 pb-8 lg:pt-12 lg:pb-12">
            <StepHeading n={2} id="choices-title" size={oneLineTitle}>
              أنت تختار، وطمّنـــي يتولى الباقي
            </StepHeading>
            <p className={intro}>أنت تحدد وش تبي تعرف عن كل ابن، ومتى وكيف تبي يوصلك الخبر.</p>
            <p className="mt-6 font-semibold">مثلًا، هذي تنبيهاتك لسما وأحمد:</p>
            <ul className="mt-3 grid gap-3 md:grid-cols-3 md:gap-6">
              {alerts.map(({ id, Icon, title, child, when, method }) => {
                const MethodIcon = method === "call" ? PhoneIcon : MessageIcon;
                return (
                  <li key={id} className="tone flex items-center gap-3 p-4 sm:p-5">
                    {/* The topic's icon, tagged with the child it is about. */}
                    <span aria-hidden="true" className="relative grid size-11 shrink-0 place-items-center rounded-full bg-surface text-board-line">
                      <Icon size={22} />
                      <span className="avatar absolute -bottom-1 -end-1 !size-5 !text-[0.6875rem] ring-2 ring-panel" data-tone={child.tone}>
                        {child.name.slice(0, 1)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-[1.0625rem] font-semibold">{title}</span>
                      <span className="block text-[0.9375rem] leading-6 text-ink-soft lg:text-base">
                        <TimeText>{when}</TimeText>
                      </span>
                    </span>
                    <span className="chip !min-h-8 !bg-surface !text-ink">
                      <MethodIcon size={15} />
                      {methodLabel[method]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[0.9375rem] leading-7 text-ink-soft lg:text-base">لكل ابن تنبيهاته: تختار نوع الخبر، ووسيلة وصوله، وتوقيته.</p>
          </div>
        </section>

        <section id="day" aria-labelledby="day-title" className="scroll-mt-4">
          <div className="pt-8 pb-14 lg:pt-12 lg:pb-24">
            <StepHeading n={3} id="day-title">
              يوم دراسي مع طمّنـــي
            </StepHeading>
            <p className={intro}>شوف كيف تصلك أخبار أبنائك خلال يوم دراسي، وفق التنبيهات اللي اخترتها.</p>
            <SchoolDay />
          </div>
        </section>
        </FlowLine>

        <section aria-labelledby="try-title" className="bg-panel">
          <div className={`${container} flex flex-col items-center py-12 text-center lg:py-20`}>
            <h2 id="try-title" className={heading}>
              جاء دورك
            </h2>
            <p className="mt-2 max-w-[36ch] text-[1.0625rem] leading-8 text-ink-soft lg:text-lg">وتقدر تغيّر اختياراتك لكل ابن.</p>
            <Suspense fallback={<WelcomeActionsFallback />}>
              <WelcomeActions />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer className="welcome-footer" />
    </TammeniExperience>
  );
}
