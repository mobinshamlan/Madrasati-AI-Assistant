/**
 * Tammeni's mark: a speech bubble (a call or a message reaching the parent) with the two square eyes
 * of لولوة and تركي from the character art. Drawn, not a letter in a box. On the chalkboard field the
 * bubble is school-bell brass, the one warm metal the sibling products also keep for their marks.
 */
export function TammeniMark({ size = 32, className, onBoard = false }: { size?: number; className?: string; onBoard?: boolean }) {
  const face = onBoard ? "var(--color-board)" : "var(--color-chalk)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path
        d="M16 3C8.8 3 3 8.2 3 14.6c0 3.7 1.9 7 5 9.1l-1 4.7c-.1.6.5 1 1 .7l5.4-3.1c.9.2 1.7.2 2.6.2 7.2 0 13-5.2 13-11.6S23.2 3 16 3Z"
        fill={onBoard ? "var(--color-bell-light)" : "var(--color-board)"}
      />
      <rect x="9.5" y="11" width="4.2" height="4.6" rx="1.1" fill={face} />
      <rect x="18.3" y="11" width="4.2" height="4.6" rx="1.1" fill={face} />
      <path d="M12.2 19.2c2.2 1.6 5.4 1.6 7.6 0" stroke={face} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** The wordmark with its mark. `sub` names the area (for example the demo studio). */
export function Wordmark({ sub, size = "md", onBoard = false }: { sub?: string; size?: "md" | "lg"; onBoard?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <TammeniMark size={size === "lg" ? 40 : 32} onBoard={onBoard} />
      <span className="flex flex-col leading-none">
        <span
          translate="no"
          className={`font-display font-semibold ${onBoard ? "text-chalk" : "text-ink"} ${size === "lg" ? "text-[1.75rem]" : "text-[1.375rem]"}`}
        >
          طمّني
        </span>
        {sub && <span className={`mt-1 text-[0.8125rem] font-medium ${onBoard ? "text-chalk-soft" : "text-faint"}`}>{sub}</span>}
      </span>
    </span>
  );
}
