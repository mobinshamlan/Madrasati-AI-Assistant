import Image from "next/image";
import { AttendanceIcon, ExamIcon, GradesIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { topicSummary, topics, usesCalls, type Method, type Preferences, type Topic } from "./preferences";

export const topicIcons: Record<Topic, typeof AttendanceIcon> = { attendance: AttendanceIcon, exams: ExamIcon, grades: GradesIcon };

/**
 * طمّني's two assistants, لولوة and تركي, drawn together. They are the assistants, never a picture of
 * the student, so the same illustration appears for every child. Decorative: every instruction is in
 * the text beside it, so it has empty alt text.
 */
export function Character({ className, size = 128 }: { className: string; size?: number }) {
  return (
    <Image src="/characters/combined.png" alt="" width={size} height={size} loading="eager" className={`shrink-0 object-contain ${className}`} />
  );
}

/** The channel, always as an icon and a word. */
export function MethodChip({ method }: { method: Method | "call" | "message" | string | null | undefined }) {
  if (method !== "call" && method !== "message" && method !== "اتصال" && method !== "رسالة") return null;
  const isCall = method === "call" || method === "اتصال";
  const Icon = isCall ? PhoneIcon : MessageIcon;
  return (
    <span className="chip" data-tone="outline">
      <Icon size={15} />
      {isCall ? "اتصال" : "رسالة"}
    </span>
  );
}

/**
 * What the parent will receive for one child: per topic, the channel and the schedule, or that it is off.
 * One reading of the saved choices, shared by the home page and the confirmation.
 */
export function PreferenceSummary({ preferences, firstName }: { preferences: Preferences; firstName: string }) {
  return (
    <ul className="divide-y divide-rule">
      {topics.map((topic) => {
        const s = topicSummary(preferences, topic);
        const Icon = topicIcons[topic];
        return (
          <li key={topic} className="flex gap-3.5 py-4 first:pt-1 last:pb-1">
            <Icon size={22} className={`mt-0.5 shrink-0 ${s.status === "on" ? "text-brand" : "text-faint"}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <p className="font-semibold text-ink">{s.label}</p>
                {s.status === "on" ? (
                  <MethodChip method={preferences[topic].method} />
                ) : s.status === "off" ? (
                  <span className="chip">متوقف</span>
                ) : (
                  <span className="chip" data-tone="danger">
                    يحتاج اختيارًا
                  </span>
                )}
              </div>
              <p className={`mt-1 text-[0.9375rem] leading-7 ${s.status === "choose" ? "text-danger" : "text-ink-soft"}`}>
                {s.status === "on" ? s.when : s.status === "off" ? `ما يوصلك شيء عن ${s.label} لـ${firstName}.` : "الخيار السابق ما عاد متاحًا. اختر موعدًا جديدًا."}
              </p>
            </div>
          </li>
        );
      })}
      {usesCalls(preferences) && (
        <li className="flex gap-3.5 py-4 last:pb-1">
          <PhoneIcon size={22} className="mt-0.5 shrink-0 text-faint" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">إذا ما رديت على الاتصال</p>
            <p className="mt-1 text-[0.9375rem] leading-7 text-ink-soft">
              {preferences.retryUnansweredCall ? "اخترت إعادة الاتصال مرة وحدة بعد ٥ دقائق. محفوظ، لكنه غير مفعّل في النسخة التجريبية." : "ما نعيد الاتصال."}
            </p>
          </div>
        </li>
      )}
    </ul>
  );
}

export function formatSavedAt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
