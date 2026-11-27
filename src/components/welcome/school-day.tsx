"use client";

import { useCallScreen } from "@/components/assistant/mock-call";
import { TimeText } from "@/components/dashboard/time-icons";
import { MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { ArrivingMessage } from "./arriving-message";
import { CallNotification } from "./call-notification";
import { DayLine } from "./day-line";
import { LockScreen } from "./lock-screen";
import { alerts, methodLabel } from "./example";
import "./welcome.css";

// One example school day with سما and أحمد, played from the alerts chosen in step 2. Each stop names the alert
// and how it came, then shows it the way a phone would: a call to answer, or a text that arrived.
// The two calls play the recorded clips; nobody's phone rings.

/** The solid handset or speech bubble inside a time's point on the day's line. */
function NodeIcon({ method }: { method: "call" | "message" }) {
  return (
    <svg className="welcome-node-solid" width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
      <path
        d={
          method === "call"
            ? "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.58 3.6a1 1 0 0 1-.25 1z"
            : "M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        }
      />
    </svg>
  );
}

export function SchoolDay() {
  const { open, screen } = useCallScreen();

  return (
    <>
      {/* Said before the day starts, so the visitor knows the calls can be tried and have sound. */}
      <p className="welcome-day-intro mt-5 max-w-[36rem] rounded-2xl bg-bell-soft px-4 py-3 text-[0.9375rem] leading-7">
        <strong>جرّب بنفسك:</strong> اضغط على المكالمة واسمعها.
      </p>
      <DayLine>
        {alerts.map((alert) => (
          <li key={alert.id} className="welcome-time">
            <span data-day-node aria-hidden="true" className="welcome-node">
              <NodeIcon method={alert.method} />
              {alert.call ? <PhoneIcon size={17} className="welcome-node-outline hidden" /> : <MessageIcon size={17} className="welcome-node-outline hidden" />}
            </span>
            <p className="flex min-h-[2.125rem] items-center gap-2">
              <bdi className="num whitespace-nowrap rounded-full bg-bell-soft px-3 text-[0.875rem] leading-7 font-bold text-bell-ink"><TimeText>{alert.time}</TimeText></bdi>
              <span className="welcome-event-method text-[0.8125rem] font-semibold text-faint">{methodLabel[alert.method]}</span>
            </p>
            <div className="welcome-event-card sheet mt-2.5 flex flex-col p-3.5 sm:p-5" data-call={alert.call ? "" : undefined}>
              <div className="welcome-event-copy">
                <p className="welcome-event-label flex items-center gap-2 text-[0.875rem] font-semibold text-ink-soft">
                  <span aria-hidden="true" className="avatar !size-7 !text-[0.8125rem]" data-tone={alert.child.tone}>
                    {alert.child.name.slice(0, 1)}
                  </span>
                  {alert.title}
                </p>
                <h3 className={`welcome-event-title ${alert.call ? "mt-2 text-[1.125rem] leading-8" : "sr-only lg:not-sr-only lg:mt-2"}`}>{alert.news}</h3>
              </div>
              <div className="welcome-event-phone mt-auto pt-4">
                {alert.call ? (
                  // The incoming call, on the same locked phone as the text. Pressing it opens the call screen.
                  <LockScreen time={alert.time}>
                    <CallNotification call={alert.call} onOpen={() => open(alert.call!)} />
                  </LockScreen>
                ) : (
                  <ArrivingMessage time={alert.time} />
                )}
              </div>
            </div>
          </li>
        ))}
      </DayLine>
      {screen}
    </>
  );
}
