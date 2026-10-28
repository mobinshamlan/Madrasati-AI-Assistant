import { students } from "./data";
import { CheckIcon, UserIcon } from "./icons";

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
}: {
  legend: string;
  selectedId: string;
  onSelect: (id: string) => void;
  name?: string;
  tone?: "plain" | "tinted";
  size?: "md" | "lg";
  legendClassName?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={legendClassName}>{legend}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {students.map((s) => (
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
