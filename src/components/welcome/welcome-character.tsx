"use client";

import Image from "next/image";
import { useState } from "react";
import "./welcome.css";

// What the assistants say. The first line introduces them; pressing the picture shows the next one.
const lines = ["مرحبًا، نحن لولوة وتركي من طمّني", "نتابع لك أخبار أبنائك في المدرسة", "ونبلّغك باتصال أو رسالة"];

/**
 * طمّني's two voice assistants, لولوة and تركي, drawn as one figure. The artwork is a single flat picture,
 * so the whole picture moves; nothing pretends to move a hand or the eyes on their own.
 */
export function WelcomeCharacter() {
  const [greetings, setGreetings] = useState(0);
  const first = greetings === 0;

  return (
    <div className="flex w-full min-w-0 flex-col-reverse items-center gap-4">
      <button
        type="button"
        aria-label="حيِّ لولوة وتركي"
        onClick={() => setGreetings((n) => n + 1)}
        className="welcome-character welcome-enter relative w-[200px] max-w-full shrink-0 sm:w-[260px] lg:w-[380px]"
      >
        {/* A flat disc the character stands in front of. */}
        <span aria-hidden="true" className="absolute inset-x-[6%] top-[10%] bottom-0 rounded-full bg-chalk" />
        <span className="relative">
          {/* Remounted on each press so the greeting plays again. */}
          <span key={greetings} className={first ? "welcome-wave-first" : "welcome-wave"}>
            <Image
              src="/characters/combined.png"
              alt=""
              width={380}
              height={380}
              loading="eager"
              fetchPriority="high"
              className="h-auto w-full"
            />
          </span>
        </span>
      </button>

      {/* The bubble stays mounted so screen readers announce each new line; only the words are swapped. */}
      <p
        aria-live="polite"
        className="welcome-bubble relative max-w-full rounded-2xl bg-bell-soft px-3 py-2 text-[0.875rem] leading-6 font-semibold text-balance text-ink sm:px-5 sm:py-3 sm:text-[1.0625rem] sm:leading-8"
      >
        <span key={greetings} className={first ? undefined : "welcome-swap"}>
          {lines[greetings % lines.length]}
        </span>
      </p>
    </div>
  );
}
