"use client";

import { useEffect } from "react";

// A refresh starts the walk-through again from the top. By itself the browser would go back to where
// the visitor was, past the hero, and the day's message would arrive before they had read anything.
export function StartAtTop() {
  useEffect(() => {
    // Remembered on this history entry, so it already holds when the next refresh loads.
    window.history.scrollRestoration = "manual";
    // "#how" left in the address would make a refresh jump down to that step, so it is taken out once
    // the hero button has done its scrolling.
    const dropHash = () => window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    window.addEventListener("hashchange", dropHash);
    // Earlier preview links included #day. Start those visits at the hero too.
    const oldPreviewLink = window.location.hash === "#day";
    if (oldPreviewLink) dropHash();
    const [load] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const reloadedHere = load?.type === "reload" && new URL(load.name).pathname === window.location.pathname;
    if (oldPreviewLink || reloadedHere) window.scrollTo({ top: 0, behavior: "instant" });
    return () => window.removeEventListener("hashchange", dropHash);
  }, []);
  return null;
}
