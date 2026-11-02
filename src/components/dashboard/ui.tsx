import { CheckIcon, InfoIcon } from "./icons";

/** Each child keeps one tint everywhere (the list is sorted by name, so the order is stable). */
export const childTone = (index: number) => (index % 2 === 1 ? "b" : "a");

/**
 * The selected child, as one segmented track of real radios. With one child it is a plain label.
 * The first letter sits in the child's own tint, so whose news is on screen is recognised at a glance.
 */
export function ChildSwitcher({
  students,
  selectedId,
  onSelect,
  name = "child",
  legend = "عرض أخبار",
}: {
  students: { id: string; firstName: string; grade: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
  name?: string;
  legend?: string;
}) {
  if (students.length < 2) {
    const s = students[0];
    return s ? (
      <p className="inline-flex items-center gap-2 font-semibold">
        <span className="avatar">{s.firstName.slice(0, 1)}</span>
        {s.firstName}
      </p>
    ) : null;
  }
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="seg">
        {students.map((s, i) => (
          <label key={s.id} className="!ps-1.5 !pe-4">
            <input
              type="radio"
              name={name}
              value={s.id}
              checked={s.id === selectedId}
              onChange={() => onSelect(s.id)}
              className="sr-only"
            />
            <span className="avatar !size-9" data-tone={childTone(i)} aria-hidden="true">
              {s.firstName.slice(0, 1)}
            </span>
            <span className="leading-tight">
              <span className="block">{s.firstName}</span>
              <span className="sr-only">، {s.grade}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A whole-label radio or checkbox. The native input stays in the DOM for the keyboard and screen readers. */
export function Choice({
  type = "radio",
  name,
  value,
  checked,
  onChange,
  title,
  hint,
  leading,
  invalid,
  describedBy,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  hint?: React.ReactNode;
  leading?: React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <label className="choice">
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="sr-only"
      />
      <span className="choice-mark" data-shape={type === "checkbox" ? "box" : undefined} aria-hidden="true">
        <CheckIcon size={13} strokeWidth={3} />
      </span>
      {leading}
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block font-semibold text-ink">{title}</span>
        {hint && <span className="mt-0.5 block text-[0.875rem] text-ink-soft">{hint}</span>}
      </span>
    </label>
  );
}

/** A failure says what failed and offers the retry; the page never falls back to bundled data. */
export function LoadProblem({ title = "تعذّر تحميل البيانات", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="notice notice-danger">
      <InfoIcon size={20} />
      <div>
        <p className="font-semibold">{title}</p>
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-danger btn-sm mt-3">
            إعادة المحاولة
          </button>
        )}
      </div>
    </div>
  );
}

/** A grey bar standing in for text of the same height while it loads. */
export function Placeholder({ className }: { className: string }) {
  return <span aria-hidden="true" className={`placeholder ${className}`} />;
}
