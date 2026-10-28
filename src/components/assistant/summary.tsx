import Image from "next/image";
import type { AssistantCharacter, Student } from "@/components/dashboard/data";
import { topicSummary, topics, usesCalls, type LegacyInfo, type Preferences, type Topic } from "./preferences";

/** What a «تعديل» button opens: the student choice, one topic, or the retry choice on the review. */
export type EditTarget = "student" | Topic | "retry";

const characterSources: Record<AssistantCharacter | "both", string> = {
  girl: "/characters/girl.png",
  boy: "/characters/boy.png",
  both: "/characters/combined.png",
};

/**
 * An illustration of the assistant, never a photograph of the student. Decorative: every
 * instruction is in the text beside it, so it has empty alt text.
 */
export function Character({ kind, className }: { kind: AssistantCharacter | "both"; className: string }) {
  return (
    <Image
      src={characterSources[kind]}
      alt=""
      width={128}
      height={128}
      loading="eager"
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function ReviewList({
  preferences,
  student,
  legacy,
  showStudent,
  showRetry,
  onEdit,
}: {
  preferences: Preferences;
  student: Student;
  legacy: LegacyInfo | null;
  showStudent?: boolean;
  showRetry?: boolean;
  /** Without it the list is read-only (the confirmation page). */
  onEdit?: (target: EditTarget) => void;
}) {
  return (
    <ul className="divide-y divide-mint-200 rounded-xl border border-mint-300 bg-white">
      {showStudent && (
        <ReviewRow label="الابن أو الابنة" target="student" onEdit={onEdit}>
          <p className="text-lg font-bold text-ink">{student.name}</p>
          <p className="text-base text-ink-soft">{student.grade}</p>
        </ReviewRow>
      )}
      {topics.map((topic) => {
        const s = topicSummary(preferences, topic);
        const was = legacy?.needsReview.find((r) => r.topic === topic);
        return (
          <ReviewRow key={topic} label={s.label} target={topic} onEdit={onEdit}>
            <p
              className={`text-lg font-bold ${
                s.status === "choose" ? "text-[#b42318]" : s.status === "off" ? "text-ink-soft" : "text-ink"
              }`}
            >
              {s.timing}
            </p>
            {s.status === "choose" && was && (
              <p className="text-base text-ink-soft">
                {was.previousRequest ? (
                  <>
                    طلبك السابق: <bdi>«{was.was}»</bdi>
                  </>
                ) : (
                  <>كان: «{was.was}»</>
                )}
              </p>
            )}
            {s.status === "off" && <p className="text-base text-ink-soft">لن تصلك تحديثات عن هذا النوع.</p>}
            {s.status === "on" && (
              <dl className="mt-1 space-y-0.5 text-base leading-7">
                <SummaryLine term="الطريقة" value={s.method} />
                <SummaryLine term="الموعد" value={s.when} />
                {s.note && <p className="text-ink-soft">{s.note}</p>}
              </dl>
            )}
          </ReviewRow>
        );
      })}
      {showRetry && usesCalls(preferences) && (
        <ReviewRow label="إعادة الاتصال" target="retry" onEdit={onEdit}>
          <p className="text-lg font-bold text-ink">
            {preferences.retryUnansweredCall ? "مرة واحدة بعد ٥ دقائق إذا لم ترد" : "لا"}
          </p>
          <p className="text-base text-ink-soft">للاتصالات التي لم يُرد عليها فقط، ولا ينطبق على الرسائل.</p>
        </ReviewRow>
      )}
    </ul>
  );
}

function ReviewRow({
  label,
  target,
  onEdit,
  children,
}: {
  label: string;
  target: EditTarget;
  onEdit?: (target: EditTarget) => void;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="font-bold text-brand-800">{label}</p>
        {children}
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(target)}
          aria-label={`تعديل ${label}`}
          className="inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center self-start rounded-lg border-2 border-brand-600 bg-white px-6 font-bold text-brand-700 transition-colors hover:bg-mint-100 sm:self-center"
        >
          تعديل
        </button>
      )}
    </li>
  );
}

function SummaryLine({ term, value }: { term: string; value?: React.ReactNode }) {
  if (value === undefined) return null;
  return (
    <div className="flex gap-x-2">
      <dt className="shrink-0 text-ink-soft">{term}:</dt>
      <dd className="min-w-0 flex-1 text-ink">{value}</dd>
    </div>
  );
}

/** The rules that apply to every saved choice, as one plain list. */
export function DeliveryNotes({ student }: { student: Student }) {
  return (
    <ul className="list-disc space-y-1.5 ps-6 text-base leading-7 text-ink marker:text-brand-600">
      <li>
        التحديثات المجدولة لـ{student.firstName} تُجمع في اتصال واحد أو رسالة واحدة فقط إذا تطابق التاريخ والوقت وطريقة
        التواصل.
      </li>
      <li>التحديثات المباشرة تصلك فور حدوثها، ولا تتأخر لتُجمع مع غيرها.</li>
      <li>جميع الأوقات بتوقيت السعودية.</li>
    </ul>
  );
}

export function DemoLabel() {
  return (
    <span className="inline-flex items-center rounded-md bg-tile-navy px-2.5 py-1 text-sm leading-none font-bold text-white">
      نسخة تجريبية
    </span>
  );
}

export function formatSavedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
