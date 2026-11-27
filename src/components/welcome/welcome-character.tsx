"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import "./welcome.css";

// طمّنـــي's two voice assistants, لولوة and تركي, drawn as one figure that greets the visitor. The art is
// the team's logo cut into layers (body, eyes, two arms), so one hand can wave and the eyes can blink.
const greeting = "مرحبًا، نحن لولوة وتركي من طمّنـــي";
const TYPE_EVERY = 80; // milliseconds per letter
const REPEAT_EVERY = 5000;

/** Whole letters with their marks, so Arabic joining and the shadda stay intact while typing. */
function letters(text: string) {
  return typeof Intl !== "undefined" && "Segmenter" in Intl
    ? Array.from(new Intl.Segmenter("ar").segment(text), (s) => s.segment)
    : Array.from(text);
}

/** The greeting, typed letter by letter and again every five seconds. With reduced motion it stays written. */
function useTypedGreeting() {
  const [typed, setTyped] = useState(greeting);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const all = letters(greeting);
    let typing: number | undefined;
    const type = () => {
      window.clearInterval(typing);
      let count = 0;
      setTyped("");
      typing = window.setInterval(() => {
        count += 1;
        setTyped(all.slice(0, count).join(""));
        if (count >= all.length) window.clearInterval(typing);
      }, TYPE_EVERY);
    };
    const first = window.setTimeout(type, 600);
    const again = window.setInterval(type, REPEAT_EVERY);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(again);
      window.clearInterval(typing);
    };
  }, []);
  return typed;
}

function Layer({ name, className }: { name: string; className?: string }) {
  // Served as they are: the four layers must arrive at the same size to line up.
  return <Image src={`/characters/greeting/${name}.webp`} alt="" width={800} height={800} unoptimized loading="eager" className={`absolute inset-0 h-full w-full ${className ?? ""}`} />;
}

export function WelcomeCharacter() {
  const typed = useTypedGreeting();

  return (
    // Phones: the robot on the left with its words beside it. Wider screens: the words above it.
    <div className="welcome-greet">
      <div aria-hidden="true" className="welcome-enter welcome-bot">
        <span className="welcome-bot-disc" />
        <span className="welcome-sway">
          <Layer name="arm-left" className="welcome-arm-left" />
          <Layer name="arm-right" />
          <Layer name="body" />
          <Layer name="eyes" className="welcome-eyes" />
        </span>
      </div>
      {/* Screen readers get the whole sentence once; the typing is only visual. */}
      <p className="welcome-bubble">
        <span className="sr-only">{greeting}</span>
        <span aria-hidden="true" className="invisible block">
          {greeting}
        </span>
        <span aria-hidden="true" className="welcome-typed">
          {typed}
        </span>
      </p>
    </div>
  );
}
