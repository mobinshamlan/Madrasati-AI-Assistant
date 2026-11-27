"use client";

import { useEffect, useRef, useState } from "react";
// The call screen looks like a real phone call; its answer button pulses like the call cards'.
import "@/components/welcome/welcome.css";

// A pretend phone call. Nobody's phone rings: the visitor presses «رد» and hears a recorded call taken
// from the project video. Like a real call, nothing that is said is written on the screen.

type Call = { id: "ahmed" | "sama"; caller: string; audio: string };

/** The one text message in the demo, shown (never sent) on the welcome and confirmation pages. */
export const EXAM_SMS = "تذكير: اختبار العلوم لأحمد غدًا الساعة 8 صباحًا.";

const calls: Call[] = [
  { id: "ahmed", caller: "تركي من طمّنـــي", audio: "/audio/call-ahmed.m4a" },
  { id: "sama", caller: "لولوة من طمّنـــي", audio: "/audio/call-sama.m4a" },
];

type Phase = "ringing" | "talking" | "ended";

// The buttons every phone shows during a call. «كتم» and «السماعة» light up when pressed, as on a real
// phone; none of them changes the recording.
const switches = new Set<string>(["كتم", "السماعة"]);
const controls = [
  ["كتم", "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3M4 4l16 16"],
  ["الأرقام", "M5 4h.01M12 4h.01M19 4h.01M5 10h.01M12 10h.01M19 10h.01M5 16h.01M12 16h.01M19 16h.01M12 22h.01"],
  ["السماعة", "M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"],
  ["إضافة", "M12 5v14M5 12h14"],
  ["فيديو", "M3 7h11v10H3zM14 11l7-4v10l-7-4"],
  ["جهات الاتصال", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c1-4 4-6 8-6s7 2 8 6"],
] as const;

/** A round call button with its word under it; "hang up" is the answer handset turned over. */
function RoundButton({ label, tone, onClick, autoFocus }: { label: string; tone: "answer" | "hangup"; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button type="button" onClick={onClick} autoFocus={autoFocus} className="flex min-w-[5.5rem] cursor-pointer flex-col items-center gap-2 text-[0.9375rem] font-semibold">
      <span
        aria-hidden="true"
        className={`grid size-[min(5rem,21vw,12vh)] place-items-center rounded-full ${tone === "answer" ? "welcome-ring-button bg-[#30c759]" : "bg-[#ff3b30]"}`}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className={`size-[48%] ${tone === "hangup" ? "rotate-[135deg]" : ""}`}>
          <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.58 3.6a1 1 0 0 1-.25 1z" />
        </svg>
      </span>
      {label}
    </button>
  );
}

const clock = (seconds: number) => `00:${String(Math.floor(seconds)).padStart(2, "0")}`;

/** The call screen itself. `open` rings it; render `screen` once anywhere on the page. */
export function useCallScreen() {
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const ring = useRef<HTMLAudioElement>(null);
  const [call, setCall] = useState<Call>(calls[0]);
  const [phase, setPhase] = useState<Phase>("ringing");
  const [time, setTime] = useState(0);
  const [lit, setLit] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  const open = (id: Call["id"]) => {
    setCall(calls.find((c) => c.id === id)!);
    setPhase("ringing");
    setTime(0);
    setLit([]);
    setFailed(false);
    dialog.current?.showModal();
    // It rings at once. This runs inside the visitor's press, which is what lets browsers play the sound.
    const bell = ring.current;
    if (bell) {
      bell.currentTime = 0;
      bell.play().catch(() => {});
    }
  };

  const silence = () => ring.current?.pause();

  const answer = () => {
    const player = audio.current;
    if (!player) return;
    silence();
    setPhase("talking");
    setTime(0);
    setFailed(false);
    player.src = call.audio;
    // Started by the visitor's press, so browsers allow the sound. If it still fails, the screen says so.
    player.play().catch(() => setFailed(true));
  };

  const hangUp = () => {
    audio.current?.pause();
    setPhase("ended");
  };

  const close = () => {
    silence();
    audio.current?.pause();
    dialog.current?.close();
  };

  // A finished call leaves the screen by itself, as on a phone. The timer keeps its last reading until then.
  useEffect(() => {
    if (phase !== "ended") return;
    const timer = window.setTimeout(() => dialog.current?.close(), 1800);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const screen = (
    <>
      <audio ref={ring} src="/audio/ringtone.m4a" preload="auto" loop />
      <audio ref={audio} preload="none" onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onEnded={() => setPhase("ended")} />

      <dialog
        ref={dialog}
        onClose={(event) => {
          // The browser can report a close late, after the next call already opened: that one keeps ringing.
          if (event.currentTarget.open) return;
          silence();
          audio.current?.pause();
        }}
        aria-label={`مكالمة تجريبية: ${call.caller}`}
        className="welcome-call m-auto h-dvh max-h-none w-full max-w-none p-0 backdrop:bg-black/70 sm:h-[min(44rem,calc(100dvh-2rem))] sm:max-w-[23rem]"
      >
        <div className="relative flex h-full flex-col items-center overflow-y-auto px-6 pt-16 pb-[calc(2.25rem+env(safe-area-inset-bottom,0px))] text-center">
          <span aria-hidden="true" className="welcome-phone-island max-sm:hidden" />
          <span aria-hidden="true" className="welcome-phone-home max-sm:hidden" />
          <p className="font-display text-[clamp(1.5rem,8vw,1.875rem)] leading-normal font-semibold whitespace-nowrap">{call.caller}</p>
          <p className="mt-1 text-[1rem] text-white/75" role="status">
            {phase === "ringing" ? "مكالمة واردة…" : phase === "talking" ? <span dir="ltr" className="num">{clock(time)}</span> : <>انتهت المكالمة <span dir="ltr" className="num">{clock(time)}</span></>}
          </p>

          <div className="min-h-0 flex-1" />
          {failed && (
            <p role="alert" className="mb-4 text-[0.875rem] text-white/80">
              تعذّر تشغيل الصوت.
            </p>
          )}

          {phase === "ringing" && (
            <div className="flex w-full justify-between px-2">
              <RoundButton label="رفض" tone="hangup" onClick={close} />
              <RoundButton label="رد" tone="answer" onClick={answer} autoFocus />
            </div>
          )}
          {phase !== "ringing" && (
            <div inert={phase === "ended"} className={`flex w-full flex-col items-center gap-[min(2.75rem,5vh)] pb-[min(3rem,5vh)] transition-opacity ${phase === "ended" ? "opacity-40" : ""}`}>
              <div className="grid w-full max-w-[20rem] grid-cols-3 justify-items-center gap-x-2 gap-y-[min(1.5rem,2.8vh)]">
                {controls.map(([label, path]) => {
                  const on = lit.includes(label);
                  const picture = (
                    <>
                      <span className={`grid size-[min(5rem,21vw,10vh)] place-items-center rounded-full ${on ? "bg-white text-[#0b2521]" : "bg-white/15"}`}>
                        <svg className="size-[42%]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={label === "الأرقام" ? 3.4 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d={path} />
                        </svg>
                      </span>
                      {label}
                    </>
                  );
                  const look = "flex flex-col items-center gap-2 text-[0.8125rem] whitespace-nowrap";
                  return switches.has(label) ? (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setLit((now) => (on ? now.filter((name) => name !== label) : [...now, label]))}
                      className={`${look} cursor-pointer`}
                    >
                      {picture}
                    </button>
                  ) : (
                    // Part of the picture only.
                    <span key={label} aria-hidden="true" className={look}>
                      {picture}
                    </span>
                  );
                })}
              </div>
              <RoundButton label="إنهاء" tone="hangup" onClick={hangUp} />
            </div>
          )}
        </div>
      </dialog>
    </>
  );

  return { open, screen };
}
