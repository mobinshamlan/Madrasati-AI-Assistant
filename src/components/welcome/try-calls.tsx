"use client";

import { useCallScreen } from "@/components/assistant/mock-call";
import { ArrivingMessage } from "./arriving-message";
import { CallNotification } from "./call-notification";
import { alerts } from "./example";
import { LockScreen } from "./lock-screen";
import "./welcome.css";

/** After saving: the two calls and the text, on the same locked phones as the welcome page's school day. */
export function TryCalls({ studentId }: { studentId: string }) {
  const { open, screen } = useCallScreen();
  // The call about the child on screen comes first; the text comes last, as in the school day.
  const about = (call: string | null | undefined) => (call ? Number((call === "sama") !== (studentId === "sama")) : 2);
  const ordered = [...alerts].sort((a, b) => about(a.call) - about(b.call));

  return (
    <section aria-labelledby="try-calls-title" className="sheet p-5 sm:p-7">
      <h2 id="try-calls-title" className="text-[1.25rem] font-bold">
        جرّب مكالمة طمّنـــي
      </h2>
      <p className="mt-3 max-w-[36rem] rounded-2xl bg-bell-soft px-4 py-3 text-[0.9375rem] leading-7">
        <strong>جرّب بنفسك:</strong> اضغط على المكالمة واسمعها.
      </p>
      <ul className="mt-5 grid gap-7 md:grid-cols-3 md:gap-4">
        {ordered.map((alert) => (
          <li key={alert.id} className="min-w-0">
            <p className="mb-2.5 flex items-center justify-center gap-2 text-[0.875rem] font-semibold text-ink-soft">
              <span aria-hidden="true" className="avatar !size-7 !text-[0.8125rem]" data-tone={alert.child.tone}>
                {alert.child.name.slice(0, 1)}
              </span>
              {alert.title}
            </p>
            {alert.call ? (
              <LockScreen time={alert.time}>
                <CallNotification call={alert.call} onOpen={() => open(alert.call!)} />
              </LockScreen>
            ) : (
              <ArrivingMessage time={alert.time} />
            )}
          </li>
        ))}
      </ul>
      {screen}
    </section>
  );
}
