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
    <div className="flex items-center gap-4 lg:flex-col-reverse lg:items-center lg:gap-6">
      <button
        type="button"
        aria-label="حيِّ لولوة وتركي"
        onClick={() => setGreetings((n) => n + 1)}
        className="welcome-character welcome-enter relative w-40 shrink-0 sm:w-48 md:w-60 lg:w-[440px]"
      >
        {/* A flat disc the character stands in front of. */}
        <span aria-hidden="true" className="absolute inset-x-[6%] top-[10%] bottom-0 rounded-full bg-mint-300" />
        <span className="welcome-float relative">
          {/* Remounted on each press so the greeting plays again. */}
          <span key={greetings} className={first ? "welcome-wave-first" : "welcome-wave"}>
            <Image
              src="/characters/combined.png"
              alt=""
              width={440}
              height={440}
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
        className="welcome-bubble relative rounded-2xl bg-white px-4 py-3 text-lg leading-8 font-bold text-balance text-ink lg:self-end lg:px-5 lg:text-xl"
      >
        <span key={greetings} className={first ? undefined : "welcome-swap"}>
          {lines[greetings % lines.length]}
        </span>
      </p>
    </div>
  );
}
