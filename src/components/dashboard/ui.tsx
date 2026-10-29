import { students } from "./data";
import type { AttendanceStatus } from "./data";
import { CheckIcon, UserIcon } from "./icons";

export const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-600 px-10 text-lg font-bold text-white hover:bg-brand-700 disabled:opacity-60";
export const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-10 text-lg font-bold text-brand-700 hover:bg-mint-100 disabled:opacity-60";
export const errorBox = "rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]";

export const statusStyles: Record<AttendanceStatus, { label: string; className: string }> = {
  present: { label: "حاضر", className: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]" },
  absent: { label: "غائب", className: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]" },
  late: { label: "متأخر", className: "bg-[#fffaeb] text-[#93370d] ring-[#fedf89]" },
  excused: { label: "غياب بعذر", className: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]" },
};

export function InfoRing({ Icon, label, value }: { Icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-brand-400 bg-white/50 text-brand-600">
        <Icon size={26} />
      </span>
      <div className="min-w-0">
        <dt className="text-sm text-ink-soft">{label}</dt>
        <dd className="font-bold text-ink">{value}</dd>
      </div>
    </div>
  );
}

export function Tile({
  href,
  Icon,
  color,
  label,
  value,
}: {
  href: string;
  Icon: typeof UserIcon;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="flex h-full flex-col items-start gap-3 rounded-lg bg-brand-600 p-2.5 text-white shadow-sm transition-colors hover:bg-brand-700 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className={`grid size-11 shrink-0 place-items-center rounded-md sm:size-14 ${color}`}>
          <Icon size={28} />
        </span>
        <span>
          <span className="block text-2xl font-extrabold leading-none">{value}</span>
          <span className="mt-1 block font-bold">{label}</span>
        </span>
      </a>
    </li>
  );
}

export function SectionTab({
  id,
  title,
  aside,
  step,
  size = "md",
}: {
  id: string;
  title: string;
  aside?: React.ReactNode;
  step?: number;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 border-b-4 border-mint-300">
      <h2
        id={id}
        className={`flex items-center gap-3 rounded-t-xl bg-brand-600 px-5 pt-2.5 pb-2 font-bold text-white ${
          size === "lg" ? "text-xl" : "text-lg"
        }`}
      >
        {step !== undefined && (
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-lg font-extrabold text-brand-700">
            <span className="sr-only">الخطوة </span>
            {step}
          </span>
        )}
        {title}
      </h2>
      {aside && <div className="pb-1.5 text-sm text-ink-soft">{aside}</div>}
    </div>
  );
}

type ChoiceCardProps = {
  type: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description?: string;
  leading?: React.ReactNode;
  tone?: "plain" | "tinted";
  size?: "md" | "lg";
  describedBy?: string;
  invalid?: boolean;
};

/** A large, fully clickable radio or checkbox. The native input stays in the DOM for keyboard and screen readers. */
export function ChoiceCard({
  type,
  name,
  value,
  checked,
  onChange,
  title,
  description,
  leading,
  tone = "plain",
  size = "lg",
  describedBy,
  invalid,
}: ChoiceCardProps) {
  const surface =
    tone === "tinted"
      ? "border-transparent bg-white/70 hover:bg-white has-[:checked]:bg-white"
      : "border-[#9da4ae] bg-white hover:border-brand-500 hover:bg-mint-50 has-[:checked]:bg-mint-100";
  const sizing = size === "lg" ? "min-h-[72px] gap-4 px-4 py-3" : "gap-3 px-3 py-2.5";

  return (
    <label
      className={`flex cursor-pointer items-center rounded-xl border-2 transition-colors has-[:checked]:border-brand-600 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tile-navy ${surface} ${sizing}`}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="peer sr-only"
      />
      {leading}
      <span className="min-w-0 flex-1 leading-snug">
        <span className={`block font-bold text-ink ${size === "lg" ? "text-lg" : ""}`}>{title}</span>
        {description && (
          <span className={`block text-ink-soft ${size === "lg" ? "mt-0.5 text-base" : "text-sm"}`}>{description}</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center border-2 border-[#6c737f] bg-white text-transparent peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white ${
          type === "radio" ? "rounded-full" : "rounded-md"
        } ${size === "lg" ? "size-7" : "size-6"}`}
      >
        <CheckIcon size={size === "lg" ? 17 : 14} strokeWidth={3} />
      </span>
    </label>
  );
}

export function StudentPicker({
  legend,
  selectedId,
  onSelect,
  name = "student",
  tone = "plain",
  size = "lg",
  legendClassName = "sr-only",
  options = students.map((s) => ({ id: s.id, name: s.name, grade: s.grade })),
}: {
  legend: string;
  selectedId: string;
  onSelect: (id: string) => void;
  name?: string;
  tone?: "plain" | "tinted";
  size?: "md" | "lg";
  legendClassName?: string;
  /** Defaults to the parent's children; the school page passes the students it loaded from the backend. */
  options?: { id: string; name: string; grade: string }[];
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={legendClassName}>{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((s) => (
          <ChoiceCard
            key={s.id}
            type="radio"
            name={name}
            value={s.id}
            checked={s.id === selectedId}
            onChange={() => onSelect(s.id)}
            title={s.name}
            description={s.grade}
            tone={tone}
            size={size}
            leading={
              <span
                className={`grid shrink-0 place-items-center rounded-full bg-mint-500 text-white ${
                  size === "lg" ? "size-12" : "size-11"
                }`}
              >
                <UserIcon size={size === "lg" ? 24 : 22} />
              </span>
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
