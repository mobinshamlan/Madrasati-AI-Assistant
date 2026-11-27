// A small picture beside a time of day: sunrise in the morning, sun at midday, a setting sun in the late
// afternoon and a moon in the evening and at night. Decorative: the words already say the time.

type Part = "morning" | "noon" | "afternoon" | "night";

const pictures: Record<Part, string> = {
  morning: "M12 9V3M9 6l3-3 3 3M5.6 11.6 7 13M18.4 11.6 17 13M2 18h3M19 18h3M8 18a4 4 0 0 1 8 0M3 22h18",
  noon: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2.5M12 19.500V22M4.900 4.900l1.800 1.800M17.300 17.300l1.800 1.800M2 12h2.500M19.500 12H22M4.900 19.100l1.800-1.800M17.300 6.700l1.800-1.800",
  afternoon: "M12 3v6M9 6l3 3 3-3M5.6 11.6 7 13M18.4 11.6 17 13M2 18h3M19 18h3M8 18a4 4 0 0 1 8 0M3 22h18",
  night: "M20.500 14.800A8.500 8.500 0 0 1 9.200 3.500a8.500 8.500 0 1 0 11.300 11.300z",
};

const colours: Record<Part, string> = { morning: "#b7791f", noon: "#c98a12", afternoon: "#c2601c", night: "#4f5f9e" };

/** "6:00 مساءً" → "night". The hour decides, so «2:00 مساءً» is still daytime. */
function partOf(hour12: number, word: string): Part {
  const hour = (hour12 % 12) + (word === "صباحًا" ? 0 : 12);
  if (hour >= 4 && hour < 11) return "morning";
  if (hour >= 11 && hour < 15) return "noon";
  if (hour >= 15 && hour < 18) return "afternoon";
  return "night";
}

const timePattern = /((\d{1,2}):\d{2} (صباحًا|ظهرًا|عصرًا|مساءً))/g;

/** `plain` keeps the surrounding text colour, for dark backgrounds. */
export function TimeIcon({ time, plain = false, size = 15 }: { time: string; plain?: boolean; size?: number }) {
  const found = new RegExp(timePattern.source).exec(time);
  if (!found) return null;
  const part = partOf(Number(found[2]), found[3]);
  return (
    <svg
      data-time={part}
      className="inline-block shrink-0 align-[-0.15em]"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={plain ? "currentColor" : colours[part]}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pictures[part]} />
    </svg>
  );
}

/** The same words, with its picture after every time of day in them. */
export function TimeText({ children, plain }: { children: string; plain?: boolean }) {
  // split() with the three groups gives: text, time, hour, word, text, …
  const pieces = children.split(timePattern);
  if (pieces.length === 1) return children;
  const out: React.ReactNode[] = [];
  for (let i = 0; i < pieces.length; i += 4) {
    out.push(pieces[i]);
    const time = pieces[i + 1];
    if (time) {
      out.push(
        <span key={i} className="whitespace-nowrap">
          {time} <TimeIcon time={time} plain={plain} />
        </span>,
      );
    }
  }
  return <>{out}</>;
}
