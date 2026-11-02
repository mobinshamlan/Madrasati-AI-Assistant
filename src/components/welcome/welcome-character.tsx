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
    <div className="flex min-w-0 flex-col-reverse items-center gap-4">
      <button
        type="button"
        aria-label="حيِّ لولوة وتركي"
        onClick={() => setGreetings((n) => n + 1)}
        className="welcome-character welcome-enter relative w-[200px] max-w-full shrink-0 sm:w-[260px] lg:w-[380px]"
      >
        {/* A flat disc the character stands in front of. */}
        <span aria-hidden="true" className="absolute inset-x-[6%] top-[10%] bottom-0 rounded-full bg-brand-soft" />
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
        className="welcome-bubble relative rounded-2xl bg-surface px-5 py-3 text-[1.0625rem] leading-8 font-semibold text-balance text-ink"
      >
        <span key={greetings} className={first ? undefined : "welcome-swap"}>
          {lines[greetings % lines.length]}
        </span>
      </p>
    </div>
  );
}
