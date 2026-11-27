"use client";

import { useEffect, useRef, useState } from "react";
import { EXAM_SMS } from "@/components/assistant/mock-call";
import { TammeniMark } from "@/components/brand/mark";
import { LockScreen } from "./lock-screen";
import { readyMessageTone, soundMessageTone } from "./message-tone";
import "./welcome.css";

// The day's text message, as it lands on the parent's locked phone at 6:00. It arrives by itself when the
// visitor reaches it, with the message tone. Browsers only allow that sound after the visitor has pressed
// something on the page; if nothing was pressed yet, it arrives silently and the next touch there sounds it.

export function ArrivingMessage({ time }: { time: string }) {
  const spot = useRef<HTMLDivElement>(null);
  const [arrived, setArrived] = useState(false);

  // The visitor's presses open the audio silently, so the tone can sound when the message arrives.
  useEffect(() => readyMessageTone(), []);

  useEffect(() => {
    const element = spot.current;
    if (!element) return;
    let timer: number | undefined;
    // For a visitor who only scrolled here: the browser kept the tone back, so their first touch with the
    // message in front of them sounds it. Presses on buttons and links are left to do their own thing.
    const touches = ["touchend", "click", "keydown"] as const;
    let trying = false;
    const stopWaiting = () => touches.forEach((name) => document.removeEventListener(name, onTouch, true));
    function onTouch(event: Event) {
      if (trying || !element) return;
      if (navigator.userActivation && !navigator.userActivation.isActive) return;
      if (event.target instanceof Element && event.target.closest("a, button")) return;
      const bounds = element.getBoundingClientRect();
      if (bounds.bottom <= 0 || bounds.top >= window.innerHeight) return;
      trying = true;
      void soundMessageTone().then((sounded) => {
        trying = false;
        if (sounded) stopWaiting();
      });
    }
    let gone = false;
    const deliver = () => {
      setArrived(true);
      void soundMessageTone().then((sounded) => {
        // Added after the presses that open the audio, so on a touch those have already run.
        if (!sounded && !gone) touches.forEach((name) => document.addEventListener(name, onTouch, true));
      });
    };
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        watcher.disconnect();
        const quick = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        timer = window.setTimeout(deliver, quick ? 0 : 900);
      },
      { threshold: 0.9 },
    );
    watcher.observe(element);
    return () => {
      gone = true;
      stopWaiting();
      watcher.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div>
      {/* Screen readers have the words from the start; the arrival is only visual and audible. */}
      <p className="sr-only">رسالة نصية من طمّنـــي: {EXAM_SMS}</p>
      <div aria-hidden="true">
        <LockScreen time={time}>
          {/* The notification's place is watched, and keeps its room while it is still on the way. */}
          <div ref={spot}>
            <div className={`welcome-notification ${arrived ? "welcome-message-in" : "invisible"}`}>
              <span className="grid size-[2.125rem] shrink-0 place-items-center rounded-[0.625rem] bg-bell-soft">
                <TammeniMark size={34} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2">
                  <span className="font-bold">طمّنـــي</span>
                  <span className="text-[0.75rem] text-faint">الآن</span>
                </p>
                <p className="welcome-message-text">{EXAM_SMS}</p>
              </div>
            </div>
          </div>
        </LockScreen>
      </div>
    </div>
  );
}
