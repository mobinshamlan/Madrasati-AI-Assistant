import Image from "next/image";

/**
 * Tammeni's logo: the two-character robot (لولوة and تركي), from /public/brand/tammeni-logo.png. The whole
 * figure stands in front of a smaller disc, so its head and arms reach past the circle.
 */
export function TammeniMark({ size = 32, className }: { size?: number; className?: string; onBoard?: boolean }) {
  return (
    <span aria-hidden="true" className={`relative inline-block shrink-0 ${className ?? ""}`} style={{ width: size, height: size }}>
      <span className="absolute inset-x-[13%] bottom-0 aspect-square rounded-full bg-chalk" />
      <Image src="/brand/tammeni-logo.png" alt="" width={size * 3} height={size * 3} loading="eager" className="relative h-full w-full object-contain" />
    </span>
  );
}

/** The wordmark with its mark. `sub` names the area (for example the demo studio). */
export function Wordmark({ sub, size = "md", onBoard = false }: { sub?: string; size?: "md" | "lg"; onBoard?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <TammeniMark size={size === "lg" ? 60 : 50} />
      <span className="flex flex-col leading-none">
        <span
          translate="no"
          className={`font-display font-semibold ${onBoard ? "text-chalk" : "text-ink"} ${size === "lg" ? "text-[1.75rem]" : "text-[1.375rem]"}`}
        >
          طمّنـــي
        </span>
        {sub && <span className={`mt-1 text-[0.8125rem] font-medium ${onBoard ? "text-chalk-soft" : "text-faint"}`}>{sub}</span>}
      </span>
    </span>
  );
}
