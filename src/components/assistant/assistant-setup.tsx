"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { students, type Student } from "@/components/dashboard/data";
import { AttendanceIcon, CheckIcon, ClockIcon, ExamIcon, GradesIcon, InfoIcon, PhoneIcon } from "@/components/dashboard/icons";
import { ChoiceCard, SectionTab, StudentPicker } from "@/components/dashboard/ui";
import {
  dayOptions,
  defaultPreferences,
  frequencyOptions,
  frequencyText,
  savePreferences,
  summarySentence,
  timeOptions,
  timeText,
  topicOptions,
  topicsText,
  useSavedPreferences,
  type Preferences,
  type Topic,
} from "./preferences";

const topicDetails: Record<Topic, { hint: string; Icon: typeof AttendanceIcon }> = {
  attendance: { hint: "أيام الغياب والتأخر", Icon: AttendanceIcon },
  exams: { hint: "مواعيد الاختبارات القادمة", Icon: ExamIcon },
  grades: { hint: "الدرجات الجديدة في المواد", Icon: GradesIcon },
};

const stepBody = "rounded-b-xl border border-t-0 border-line bg-white p-5 sm:p-6";
const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-600 px-8 text-lg font-bold text-white hover:bg-brand-700";
const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-8 text-lg font-bold text-brand-700 hover:bg-mint-100";

export function AssistantSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const student = students.find((s) => s.id === searchParams.get("student")) ?? students[0];
  const saved = useSavedPreferences(student.id);
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const [justSavedFor, setJustSavedFor] = useState<string | null>(null);

  const selectStudent = (id: string) => {
    setEditingFor(null);
    setJustSavedFor(null);
    router.replace(`/assistant?student=${id}`, { scroll: false });
  };

  const showForm = saved.status !== "saved" || editingFor === student.id;
  const formKey = `${student.id}:${saved.status === "saved" ? saved.preferences.savedAt : saved.status}`;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 text-lg">
      <section aria-labelledby="step-student">
        <SectionTab id="step-student" step={1} title="اختر الابن أو الابنة" size="lg" />
        <div className={stepBody}>
          <StudentPicker
            legend="اختر الابن أو الابنة"
            name="assistant-student"
            selectedId={student.id}
            onSelect={selectStudent}
          />
        </div>
      </section>

      {showForm ? (
        <PreferencesForm
          key={formKey}
          student={student}
          initial={saved.status === "saved" ? saved.preferences : defaultPreferences}
          hadInvalidData={saved.status === "invalid"}
          onCancel={saved.status === "saved" ? () => setEditingFor(null) : undefined}
          onSaved={() => {
            setEditingFor(null);
            setJustSavedFor(student.id);
          }}
        />
      ) : (
        <SavedSummary
          key={student.id}
          student={student}
          preferences={saved.preferences}
          justSaved={justSavedFor === student.id}
          onEdit={() => {
            setJustSavedFor(null);
            setEditingFor(student.id);
          }}
        />
      )}
    </div>
  );
}

function PreferencesForm({
  student,
  initial,
  hadInvalidData,
  onCancel,
  onSaved,
}: {
  student: Student;
  initial: Preferences;
  hadInvalidData: boolean;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [saveFailed, setSaveFailed] = useState(false);
  const topicsRef = useRef<HTMLFieldSetElement>(null);
  const noTopics = prefs.topics.length === 0;

  const update = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const toggleTopic = (topic: Topic) =>
    update({
      topics: prefs.topics.includes(topic) ? prefs.topics.filter((t) => t !== topic) : [...prefs.topics, topic],
    });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noTopics) {
      topicsRef.current?.scrollIntoView({ block: "center" });
      topicsRef.current?.querySelector("input")?.focus();
      return;
    }
    if (savePreferences(student.id, prefs)) {
      setSaveFailed(false);
      onSaved();
    } else {
      setSaveFailed(true);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-label={`تفضيلات المساعد الذكي لـ${student.name}`} className="space-y-8">
      {hadInvalidData && (
        <p className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[#7a2e0e]">
          <InfoIcon size={24} className="mt-1 shrink-0" />
          تعذّرت قراءة الاختيارات المحفوظة سابقًا على هذا الجهاز، لذلك عرضنا الاختيارات المقترحة. اضغط «حفظ التفضيلات» لحفظها من جديد.
        </p>
      )}

      <section aria-labelledby="step-topics">
        <SectionTab id="step-topics" step={2} title="اختر التحديثات التي تريدها" size="lg" />
        <div className={stepBody}>
          <fieldset ref={topicsRef} className="min-w-0">
            <legend className="sr-only">اختر التحديثات التي تريدها</legend>
            <p id="topics-hint" className="mb-4 text-ink-soft">
              يمكنك اختيار أكثر من نوع. يلزم اختيار نوع واحد على الأقل.
            </p>
            <div className="grid gap-3">
              {topicOptions.map((o) => {
                const { hint, Icon } = topicDetails[o.value];
                return (
                  <ChoiceCard
                    key={o.value}
                    type="checkbox"
                    name="topics"
                    value={o.value}
                    checked={prefs.topics.includes(o.value)}
                    onChange={() => toggleTopic(o.value)}
                    title={o.label}
                    description={hint}
                    describedBy={noTopics ? "topics-hint topics-error" : "topics-hint"}
                    invalid={noTopics}
                    leading={
                      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint-200 text-brand-700">
                        <Icon size={26} />
                      </span>
                    }
                  />
                );
              })}
            </div>
            {noTopics && (
              <p id="topics-error" role="alert" className="mt-4 rounded-lg bg-[#fef3f2] px-4 py-3 font-bold text-[#b42318]">
                اختر نوعًا واحدًا على الأقل من التحديثات.
              </p>
            )}
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="step-frequency">
        <SectionTab id="step-frequency" step={3} title="كم مرة تريد التحديث؟" size="lg" />
        <div className={`${stepBody} space-y-6`}>
          <fieldset className="min-w-0">
            <legend className="sr-only">كم مرة تريد التحديث؟</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {frequencyOptions.map((o) => (
                <ChoiceCard
                  key={o.value}
                  type="radio"
                  name="frequency"
                  value={o.value}
                  checked={prefs.frequency === o.value}
                  onChange={() => update({ frequency: o.value })}
                  title={o.label}
                  description={o.hint}
                />
              ))}
            </div>
          </fieldset>

          {prefs.frequency === "weekly" && (
            <fieldset className="min-w-0">
              <legend className="mb-3 font-bold text-ink">اختر يوم الاتصال</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {dayOptions.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    type="radio"
                    name="day"
                    value={o.value}
                    checked={prefs.day === o.value}
                    onChange={() => update({ day: o.value })}
                    title={o.label}
                  />
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </section>

      <section aria-labelledby="step-time">
        <SectionTab id="step-time" step={4} title="اختر وقت الاتصال" size="lg" />
        <div className={stepBody}>
          <fieldset className="min-w-0">
            <legend className="mb-4 flex items-center gap-2 font-bold text-brand-800">
              <ClockIcon size={22} />
              جميع الأوقات بتوقيت السعودية
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {timeOptions.map((o) => (
                <ChoiceCard
                  key={o.value}
                  type="radio"
                  name="time"
                  value={o.value}
                  checked={prefs.time === o.value}
                  onChange={() => update({ time: o.value })}
                  title={o.label}
                  description="بتوقيت السعودية"
                />
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="step-review">
        <SectionTab id="step-review" step={5} title="راجع اختياراتك واحفظها" size="lg" />
        <div className={`${stepBody} space-y-5`}>
          <div className="flex flex-col gap-4 rounded-xl bg-mint-100 p-5 ring-1 ring-mint-300 sm:flex-row" aria-live="polite">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
              <PhoneIcon size={24} />
            </span>
            <p className="text-xl leading-9 font-medium text-ink">
              {noTopics
                ? "لم تختر أي نوع من التحديثات بعد. اختر نوعًا واحدًا على الأقل في الخطوة 2."
                : summarySentence(prefs, student.firstName)}
            </p>
          </div>
          <DemoSaveNote />
          {saveFailed && (
            <p role="alert" className="rounded-lg bg-[#fef3f2] px-4 py-3 font-bold text-[#b42318]">
              تعذّر الحفظ على هذا الجهاز. تأكد أن المتصفح يسمح بحفظ البيانات، ثم حاول مرة أخرى.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" className={primaryButton}>
              حفظ التفضيلات
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className={secondaryButton}>
                إلغاء التعديل
              </button>
            )}
          </div>
        </div>
      </section>
    </form>
  );
}

function SavedSummary({
  student,
  preferences,
  justSaved,
  onEdit,
}: {
  student: Student;
  preferences: Preferences;
  justSaved: boolean;
  onEdit: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Move focus to the confirmation so keyboard and screen-reader users land on it.
    if (justSaved) headingRef.current?.focus();
  }, [justSaved]);
  const rows = [
    { label: "الابن أو الابنة", value: student.name },
    { label: "التحديثات", value: topicsText(preferences.topics) },
    { label: "عدد المرات", value: frequencyText(preferences) },
    { label: "وقت الاتصال", value: timeText(preferences) },
  ];
  if (preferences.savedAt) rows.push({ label: "آخر حفظ", value: formatSavedAt(preferences.savedAt) });

  return (
    <section aria-labelledby="saved-title">
      {justSaved ? (
        <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-[#abefc6] bg-[#ecfdf3] p-5" role="status">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#067647] text-white">
            <CheckIcon size={28} strokeWidth={3} />
          </span>
          <div>
            <h2 id="saved-title" ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold text-[#085d3a] focus:outline-none">
              تم حفظ التفضيلات
            </h2>
            <p className="mt-1 text-[#085d3a]">حفظنا اختياراتك الخاصة بـ{student.firstName}.</p>
          </div>
        </div>
      ) : (
        <SectionTab id="saved-title" title={`تفضيلاتك المحفوظة لـ${student.firstName}`} size="lg" />
      )}

      <div className={`${justSaved ? "rounded-xl border" : "rounded-b-xl border border-t-0"} space-y-5 border-line bg-white p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 rounded-xl bg-mint-100 p-5 ring-1 ring-mint-300 sm:flex-row">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
            <PhoneIcon size={24} />
          </span>
          <p className="text-xl leading-9 font-medium text-ink">{summarySentence(preferences, student.firstName)}</p>
        </div>

        <dl className="divide-y divide-mint-200 rounded-xl border border-mint-200">
          {rows.map((r) => (
            <div key={r.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-ink-soft">{r.label}</dt>
              <dd className="font-bold text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>

        <DemoSaveNote />

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onEdit} className={primaryButton}>
            تعديل التفضيلات
          </button>
          <Link href="/" className={secondaryButton}>
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    </section>
  );
}

function DemoSaveNote() {
  return (
    <p className="flex gap-3 rounded-xl border border-[#b2ddff] bg-[#eff8ff] p-4 text-base leading-7 text-[#194185]">
      <InfoIcon size={22} className="mt-0.5 shrink-0" />
      <span>
        هذا نموذج تجريبي: تُحفظ اختياراتك على هذا الجهاز فقط، <strong>ولم تتم جدولة أي مكالمة فعلية.</strong>
      </span>
    </p>
  );
}

function formatSavedAt(iso: string) {
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
