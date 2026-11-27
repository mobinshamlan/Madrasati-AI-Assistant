"use client";

import { useEffect, useRef } from "react";
import "./welcome.css";

/**
 * The walk-through's single line: it runs down the side of the three steps, joining their numbers, and fills
 * as the visitor reads down. A step's number lights once the reader reaches it.
 */
export function FlowLine({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = root.current;
    if (!box) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const dots = [...box.querySelectorAll<HTMLElement>("[data-step-dot]")];
      if (!rail.current || !fill.current || dots.length < 2) return;
      const top = box.getBoundingClientRect().top;
      const centre = (dot: HTMLElement) => dot.getBoundingClientRect().top + dot.offsetHeight / 2 - top;
      const first = centre(dots[0]);
      const length = centre(dots[dots.length - 1]) - first;
      rail.current.style.top = `${first}px`;
      rail.current.style.height = `${length}px`;
      // The line is read a little below the middle of the screen; at the very bottom of the page it is complete.
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const mark = window.innerHeight * 0.6;
      const reached = atEnd ? length : Math.max(0, Math.min(length, mark - top - first));
      fill.current.style.height = `${reached}px`;
      dots.forEach((dot, i) => {
        dot.toggleAttribute("data-lit", i === 0 || atEnd || centre(dot) <= first + reached + 1);
      });
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", later, { passive: true });
    const resize = new ResizeObserver(later);
    resize.observe(box);
    return () => {
      window.removeEventListener("scroll", later);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="welcome-flow relative mx-auto w-full max-w-[1100px] ps-[3.25rem] pe-4 sm:ps-20 sm:pe-6 lg:pe-20">
      <span ref={rail} aria-hidden="true" className="welcome-flow-rail">
        <span ref={fill} />
      </span>
      {children}
    </div>
  );
}
