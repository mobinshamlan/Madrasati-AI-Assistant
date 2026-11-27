"use client";

import { useEffect, useRef } from "react";
import "./welcome.css";

/**
 * The school day's own line, in gold, inside the walk-through's. It runs from the first time to the last and
 * fills as the visitor reads through the day; each time lights when reached, and the latest one pulses.
 */
export function DayLine({ children }: { children: React.ReactNode }) {
  const list = useRef<HTMLOListElement>(null);
  const rail = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const day = list.current;
    if (!day) return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const nodes = [...day.querySelectorAll<HTMLElement>("[data-day-node]")];
      if (!rail.current || !fill.current || nodes.length < 2) return;
      const top = day.getBoundingClientRect().top;
      // offsetTop, not the drawn box: a lit point is drawn slightly larger.
      const centre = (node: HTMLElement) => (node.parentElement as HTMLElement).offsetTop + node.offsetTop + node.offsetHeight / 2;
      const first = centre(nodes[0]);
      const length = centre(nodes[nodes.length - 1]) - first;
      rail.current.style.top = `${first}px`;
      rail.current.style.height = `${length}px`;
      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const reached = atEnd ? length : Math.max(0, Math.min(length, window.innerHeight * 0.6 - top - first));
      fill.current.style.height = `${reached}px`;
      let latest = 0;
      nodes.forEach((node, i) => {
        const lit = i === 0 || atEnd || centre(node) <= first + reached + 1;
        node.toggleAttribute("data-lit", lit);
        if (lit) latest = i;
      });
      nodes.forEach((node, i) => node.toggleAttribute("data-now", i === latest));
    };
    const later = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", later, { passive: true });
    const resize = new ResizeObserver(later);
    resize.observe(day);
    return () => {
      window.removeEventListener("scroll", later);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="welcome-day relative mt-6 max-w-[36rem] md:mt-8">
      <span ref={rail} aria-hidden="true" className="welcome-day-rail">
        <span ref={fill} />
      </span>
      <ol ref={list} className="relative grid gap-6">
        {children}
      </ol>
    </div>
  );
}
