"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { students, type Student } from "@/components/dashboard/data";
import {
  AttendanceIcon,
  CheckIcon,
  ClockIcon,
  ExamIcon,
  GradesIcon,
  InfoIcon,
  MessageIcon,
  PhoneIcon,
} from "@/components/dashboard/icons";
import { ChoiceCard, SectionTab, StudentPicker } from "@/components/dashboard/ui";
import { AFTER_SCHOOL_TIME } from "./config";
import {
  DAYS_OF_MONTH,
  allProblems,
  attendanceCustomOptions,
  attendanceTimingOptions,
  dayOptions,
  defaultPreferences,
  enabledTopics,
  EXAM_DAYS,
  examDaysOptionLabel,
  examTimingOptions,
  getTime,
  gradesTimingOptions,
  isEnabled,
  methodOptions,
  needsTime,
  problemsFor,
  savePreferences,
  isPresetTime,
  joinTime,
  presetTimeOptions,
  splitTime,
  topicLabels,
  topicSummary,
  usesCalls,
  useSavedPreferences,
  type ContactTime,
  type Period,
  type Day,
  type LegacyInfo,
  type Method,
  type Preferences,
  type Problem,
  type Topic,
} from "./preferences";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_COUNT = 5;
const stepTitles: Record<Step, string> = {
  1: "اختر الابن أو الابنة",
  2: "الحضور والغياب",
  3: "تذكير الاختبار",
  4: "ملخص الدرجات",
  5: "مراجعة اختياراتك",
};
const topicSteps: Record<Topic, Step> = { attendance: 2, exams: 3, grades: 4 };
const stepTopics: Partial<Record<Step, Topic>> = { 2: "attendance", 3: "exams", 4: "grades" };
const topicIcons: Record<Topic, typeof AttendanceIcon> = { attendance: AttendanceIcon, exams: ExamIcon, grades: GradesIcon };
const timingOptions = { attendance: attendanceTimingOptions, exams: examTimingOptions, grades: gradesTimingOptions };
const timingQuestions: Record<Topic, string> = {
  attendance: "متى يصلك تحديث الحضور؟",
  exams: "متى يصلك تذكير الاختبار؟",
  grades: "متى يصلك ملخص الدرجات؟",
};

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const stepLabel = (step: Step) => `الخطوة ${toArabicDigits(step)} من ${toArabicDigits(STEP_COUNT)}`;

const card = "rounded-b-xl border border-t-0 border-line bg-white p-5 sm:p-6";
const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-600 px-10 text-lg font-bold text-white hover:bg-brand-700";
const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-10 text-lg font-bold text-brand-700 hover:bg-mint-100";
const errorBox = "rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]";
const saveErrorText = "تعذّر الحفظ على هذا الجهاز. تأكد أن المتصفح يسمح بحفظ البيانات، ثم حاول مرة أخرى.";
const switchStudentNote = "عند اختيار ابن آخر تظهر اختياراته هو، ولا تُحفظ أي تغييرات لم تضغط بعدها «حفظ التفضيلات».";

const problemText = (problem: Problem) =>
  problem.kind === "time"
    ? `${topicLabels[problem.topic]}: اختر وقتًا من الخيارات، أو اكتب وقتًا كاملًا (الساعة والدقيقة) في «وقت آخر».`
    : `${topicLabels[problem.topic]}: اختر أحد الخيارات وتأكد من اليوم.`;

export function AssistantSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const student = students.find((s) => s.id === searchParams.get("student")) ?? students[0];
  const saved = useSavedPreferences(student.id);
  const [editing, setEditing] = useState<{ studentId: string; step: Step } | null>(null);
  const [justSavedFor, setJustSavedFor] = useState<string | null>(null);
  // The view remounts for the new student, so remember to put focus back on the student choice.
  const [pickerFocusFor, setPickerFocusFor] = useState<string | null>(null);

  const selectStudent = (id: string) => {
    setEditing(null);
    setJustSavedFor(null);
    setPickerFocusFor(id);
    router.replace(`/assistant?student=${id}`, { scroll: false });
  };
  const markSaved = () => {
    setEditing(null);
    setPickerFocusFor(null);
    setJustSavedFor(student.id);
  };

  const editingThis = editing?.studentId === student.id ? editing : null;
  const showWizard = saved.status !== "saved" || editingThis !== null;
  // Remounting per student (and per saved version) keeps each student's draft separate.
  const wizardKey = `${student.id}:${
    saved.status === "saved" ? `${saved.preferences.savedAt}:${saved.legacy ? "legacy" : "v4"}` : saved.status
  }`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-lg">
      {showWizard ? (
        <Wizard
          key={wizardKey}
          student={student}
          initial={saved.status === "saved" ? saved.preferences : defaultPreferences}
          legacy={saved.status === "saved" ? saved.legacy : null}
          hadInvalidData={saved.status === "invalid"}
          startStep={editingThis?.step ?? 1}
          focusOnMount={editingThis !== null}
          focusPicker={pickerFocusFor === student.id}
          onSelectStudent={selectStudent}
          onCancel={saved.status === "saved" ? () => setEditing(null) : undefined}
          onSaved={markSaved}
        />
      ) : (
        <SavedSummary
          key={student.id}
          student={student}
          preferences={saved.preferences}
          legacy={saved.legacy}
          justSaved={justSavedFor === student.id}
          focusPicker={pickerFocusFor === student.id}
          onSelectStudent={selectStudent}
          onSaved={markSaved}
          onEdit={(step) => {
            setJustSavedFor(null);
            setPickerFocusFor(null);
            setEditing({ studentId: student.id, step });
          }}
        />
      )}
    </div>
  );
}

function Wizard({
  student,
  initial,
  legacy,
  hadInvalidData,
  startStep,
  focusOnMount,
  focusPicker,
  onSelectStudent,
  onCancel,
  onSaved,
}: {
  student: Student;
  initial: Preferences;
  legacy: LegacyInfo | null;
  hadInvalidData: boolean;
  startStep: Step;
  focusOnMount: boolean;
  focusPicker: boolean;
  onSelectStudent: (id: string) => void;
  onCancel?: () => void;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [step, setStep] = useState<Step>(startStep);
  // Set when a step is opened from «تعديل»; that step then leads straight back to the review.
  const [returnToReview, setReturnToReview] = useState(startStep !== 5 && focusOnMount);
  // Errors appear only after the parent tries to continue, so a fresh step is never shown in red.
  const [attempted, setAttempted] = useState<Step[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveErrorsRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(focusOnMount);

  useEffect(() => {
    if (focusPicker) bodyRef.current?.querySelector<HTMLInputElement>("input[name=assistant-student]:checked")?.focus();
  }, [focusPicker]);

  useEffect(() => {
    // Only after the parent moves between steps, so the first page load keeps its natural focus.
    if (!focusPending.current) return;
    focusPending.current = false;
    headingRef.current?.scrollIntoView({ block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const goTo = (next: Step) => {
    focusPending.current = true;
    setStep(next);
  };

  const goNext = () => {
    const topic = stepTopics[step];
    const problem = topic ? problemsFor(prefs, topic)[0] : undefined;
    if (problem) {
      setAttempted((a) => [...a, step]);
      const target = problem.kind === "time" ? `#${problem.topic}-hour` : `input[name="${problem.topic}-timing"]`;
      bodyRef.current?.querySelector<HTMLElement>(target)?.focus();
      return;
    }
    if (returnToReview) {
      setReturnToReview(false);
      goTo(5);
    } else {
      goTo((step + 1) as Step);
    }
  };
  const editFromReview = (target: Step) => {
    setReturnToReview(target !== 5);
    goTo(target);
  };

  const problems = allProblems(prefs);
  const noneEnabled = enabledTopics(prefs).length === 0;
  const save = () => {
    if (problems.length > 0 || noneEnabled) {
      setAttempted([2, 3, 4, 5]);
      saveErrorsRef.current?.scrollIntoView({ block: "center" });
      saveErrorsRef.current?.focus({ preventScroll: true });
      return;
    }
    if (savePreferences(student.id, prefs)) {
      setSaveFailed(false);
      onSaved();
    } else {
      setSaveFailed(true);
    }
  };

  const topic = stepTopics[step];
  const showSaveErrors = attempted.includes(5) || noneEnabled;

  return (
    <section aria-labelledby="wizard-heading">
      {(step === 1 || step === 5) && hadInvalidData && (
        <p className="mb-6 flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[#7a2e0e]">
          <InfoIcon size={24} className="mt-1 shrink-0" />
          تعذّرت قراءة الاختيارات المحفوظة سابقًا على هذا الجهاز، لذلك عرضنا الاختيارات المقترحة. اضغط «حفظ التفضيلات» في الخطوة الأخيرة لحفظها من جديد.
        </p>
      )}
      {(step === 1 || step === 5) && legacy && (
        <div className="mb-6">
          <LegacyNotice legacy={legacy} />
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-4 border-b-4 border-mint-300">
        <h2
          id="wizard-heading"
          ref={headingRef}
          tabIndex={-1}
          className="rounded-t-xl bg-brand-600 px-5 pt-3 pb-2.5 text-2xl font-bold text-white"
        >
          <span className="sr-only">{stepLabel(step)}: </span>
          {stepTitles[step]}
        </h2>
        <p aria-hidden="true" className="pb-2 text-lg font-bold text-brand-800">
          {stepLabel(step)}
        </p>
      </div>

      <div ref={bodyRef} className={card}>
        <div aria-hidden="true" className="mb-6 grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`h-2 rounded-full ${n <= step ? "bg-brand-500" : "bg-mint-200"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <StudentPicker
              legend="اختر الابن أو الابنة"
              name="assistant-student"
              selectedId={student.id}
              onSelect={(id) => id !== student.id && onSelectStudent(id)}
            />
            <p className="text-base leading-7 text-ink-soft">{switchStudentNote}</p>
          </div>
        )}

        {topic && (
          <TopicStep
            topic={topic}
            prefs={prefs}
            setPrefs={setPrefs}
            student={student}
            showErrors={attempted.includes(step)}
            previous={legacy?.needsReview.find((r) => r.topic === topic)}
          />
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-ink">ملخص اختياراتك</h3>
              {showSaveErrors && (problems.length > 0 || noneEnabled) && (
                <div ref={saveErrorsRef} tabIndex={-1} role="alert" className={errorBox}>
                  <p>لا يمكن الحفظ بعد:</p>
                  <ul className="mt-2 list-disc space-y-1 ps-6">
                    {noneEnabled && <li>كل التحديثات متوقفة. فعّل نوعًا واحدًا على الأقل باستخدام زر «تعديل».</li>}
                    {problems.map((p) => (
                      <li key={p.topic}>{problemText(p)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ReviewList preferences={prefs} student={student} legacy={legacy} showStudent onEdit={editFromReview} />
            </div>

            {usesCalls(prefs) && (
              <ChoiceCard
                type="checkbox"
                name="retry"
                value="retry"
                checked={prefs.retryUnansweredCall}
                onChange={() => setPrefs((p) => ({ ...p, retryUnansweredCall: !p.retryUnansweredCall }))}
                title="إذا لم أرد، أعد الاتصال مرة واحدة بعد ٥ دقائق"
                description="اختياري. للاتصالات التي لم يُرد عليها فقط، ولا ينطبق على الرسائل."
              />
            )}

            <DeliveryNotes student={student} />
            <DemoSaveNote />
            {saveFailed && (
              <p role="alert" className="rounded-lg bg-[#fef3f2] px-4 py-3 font-bold text-[#b42318]">
                {saveErrorText}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-mint-200 pt-6 sm:flex-row sm:justify-between">
          {step > 1 && !returnToReview ? (
            <button type="button" onClick={() => goTo((step - 1) as Step)} className={secondaryButton}>
              السابق
            </button>
          ) : (
            <span className="hidden sm:block" />
          )}
          {step === 5 ? (
            <button type="button" onClick={save} className={primaryButton}>
              حفظ التفضيلات
            </button>
          ) : (
            <button type="button" onClick={goNext} className={primaryButton}>
              {returnToReview ? "العودة إلى المراجعة" : "التالي"}
            </button>
          )}
        </div>
        {onCancel && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 px-3 font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
            >
              إلغاء التعديل والعودة إلى التفضيلات المحفوظة
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

type SetPrefs = React.Dispatch<React.SetStateAction<Preferences>>;

function TopicStep({
  topic,
  prefs,
  setPrefs,
  student,
  showErrors,
  previous,
}: {
  topic: Topic;
  prefs: Preferences;
  setPrefs: SetPrefs;
  student: Student;
  showErrors: boolean;
  previous?: LegacyInfo["needsReview"][number];
}) {
  const Icon = topicIcons[topic];
  const timing = prefs[topic].timing;
  const enabled = isEnabled(prefs, topic);
  const problem = showErrors ? problemsFor(prefs, topic)[0] : undefined;
  const invalid = problem?.kind === "choose";

  const patch = (change: Record<string, unknown>) =>
    setPrefs((p) => ({ ...p, [topic]: { ...p[topic], ...change } }) as Preferences);
  const patchCustom = (change: Partial<Preferences["attendance"]["custom"]>) =>
    setPrefs((p) => ({ ...p, attendance: { ...p.attendance, custom: { ...p.attendance.custom, ...change } } }));

  const intro: Record<Topic, string> = {
    attendance: `اختر متى تريد أن تعرف عن حضور ${student.firstName} وغيابه، وكيف يصلك ذلك.`,
    exams: `اختر متى يصلك تذكير باختبارات ${student.firstName}، وكيف يصلك.`,
    grades: `اختر متى يصلك ملخص درجات ${student.firstName}، وكيف يصلك.`,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint-200 text-brand-700">
          <Icon size={26} />
        </span>
        <p className="leading-8 text-ink">{intro[topic]}</p>
      </div>

      {previous && timing === null && (
        <p className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 font-bold text-[#7a2e0e]">
          <InfoIcon size={22} className="mt-1 shrink-0" />
          {previous.previousRequest ? (
            <span>
              طلبك السابق: <bdi>«{previous.was}»</bdi>. لا نفسّر النص المكتوب تلقائيًا، فاختر موعدًا من الخيارات التالية.
            </span>
          ) : (
            <span>كان اختيارك السابق «{previous.was}»، وهذا الخيار لم يعد متاحًا. اختر بديلًا من الخيارات التالية.</span>
          )}
        </p>
      )}

      <fieldset className="min-w-0" aria-describedby={invalid ? `${topic}-timing-error` : undefined}>
        <legend className="mb-3 font-bold text-ink">{timingQuestions[topic]}</legend>
        <div className="grid gap-3">
          {timingOptions[topic].map((o) => (
            <ChoiceCard
              key={o.value}
              type="radio"
              name={`${topic}-timing`}
              value={o.value}
              checked={timing === o.value}
              onChange={() => patch({ timing: o.value })}
              title={o.label}
              description={o.hint}
              invalid={invalid}
            />
          ))}
          <ChoiceCard
            type="radio"
            name={`${topic}-timing`}
            value="off"
            checked={timing === "off"}
            onChange={() => patch({ timing: "off" })}
            title="إيقاف"
            description="لن تصلك تحديثات عن هذا النوع"
            invalid={invalid}
          />
        </div>
        {invalid && (
          <p id={`${topic}-timing-error`} role="alert" className={`mt-4 ${errorBox}`}>
            اختر أحد الخيارات للمتابعة.
          </p>
        )}
      </fieldset>

      {topic === "attendance" && timing === "custom" && (
        <div className="space-y-5">
          <fieldset className="min-w-0">
            <legend className="mb-3 font-bold text-ink">ما نوع الملخص الذي تريده؟</legend>
            <div className="grid gap-3">
              {attendanceCustomOptions.map((o) => (
                <ChoiceCard
                  key={o.value}
                  type="radio"
                  name="attendance-custom-kind"
                  value={o.value}
                  checked={prefs.attendance.custom.kind === o.value}
                  onChange={() => patchCustom({ kind: o.value })}
                  title={o.label}
                  description={o.hint}
                />
              ))}
            </div>
          </fieldset>
          {prefs.attendance.custom.kind === "weekly" && (
            <DayPicker
              name="attendance-day"
              legend="اختر يوم الملخص الأسبوعي"
              value={prefs.attendance.custom.day}
              onChange={(day) => patchCustom({ day })}
            />
          )}
        </div>
      )}

      {topic === "exams" && timing === "custom" && (
        <ExamDaysSelect value={prefs.exams.customDays} onChange={(customDays) => patch({ customDays })} />
      )}

      {topic === "grades" && timing === "monthly" && (
        <DayOfMonthSelect value={prefs.grades.dayOfMonth} onChange={(dayOfMonth) => patch({ dayOfMonth })} />
      )}

      {enabled && <MethodPicker topic={topic} value={prefs[topic].method} onChange={(method) => patch({ method })} />}

      {enabled && needsTime(prefs, topic) && (
        <TimePicker
          topic={topic}
          value={getTime(prefs, topic)}
          onChange={(time) => (topic === "attendance" ? patchCustom({ time }) : patch({ time }))}
          showError={problem?.kind === "time"}
        />
      )}

      {enabled && <TopicRules topic={topic} prefs={prefs} />}
    </div>
  );
}

function TopicRules({ topic, prefs }: { topic: Topic; prefs: Preferences }) {
  const timing = prefs[topic].timing;
  const rules: string[] = [];
  if (topic === "attendance") {
    if (timing === "immediate") {
      rules.push("لا يوجد وقت محدد: يصلك التواصل عند تسجيل الحضور أو الغياب أو التأخر، وليس عند الغياب فقط.");
    }
    if (timing === "end-of-day") {
      rules.push(
        `يصلك الملخص كل يوم الساعة ${AFTER_SCHOOL_TIME.label} بتوقيت السعودية. هذا وقت ثابت افتراضي للنموذج التجريبي وليس وقت انصراف رسميًا.`,
      );
    }
    rules.push("لا يصلك شيء عن الغياب بعذر مقبول. وإذا قُبل العذر قبل إرسال التحديث، يُلغى التحديث.");
  }
  if (topic === "exams") rules.push("إذا أُلغي اختبار، نبلغك بالطريقة نفسها.");
  if (topic === "grades") {
    rules.push(
      timing === "immediate"
        ? "لا يوجد وقت محدد: يصلك تحديث مستقل لكل مادة فور نشر درجتها."
        : "يشمل الملخص جميع المواد التي نُشرت درجاتها الجديدة في الشهر السابق كاملًا. إذا لم تُنشر درجات جديدة، لا يصلك ملخص.",
    );
  }
  return (
    <ul className="space-y-3">
      {rules.map((r) => (
        <li key={r} className="flex gap-3 rounded-xl bg-mint-100 p-4 leading-8 text-ink ring-1 ring-mint-300">
          <InfoIcon size={22} className="mt-1.5 shrink-0 text-brand-700" />
          <span>{r}</span>
        </li>
      ))}
    </ul>
  );
}

function MethodPicker({ topic, value, onChange }: { topic: Topic; value: Method; onChange: (method: Method) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-bold text-ink">كيف يصلك؟</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {methodOptions.map((o) => {
          const Icon = o.value === "call" ? PhoneIcon : MessageIcon;
          return (
            <ChoiceCard
              key={o.value}
              type="radio"
              name={`${topic}-method`}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              title={o.label}
              description={o.hint}
              leading={
                <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint-200 text-brand-700">
                  <Icon size={24} />
                </span>
              }
            />
          );
        })}
      </div>
    </fieldset>
  );
}

const selectClass =
  "block min-h-14 w-full rounded-xl border-2 bg-white px-3 text-lg font-bold text-ink focus:border-brand-600";

function TimePicker({
  topic,
  value,
  onChange,
  showError,
}: {
  topic: Topic;
  value: ContactTime;
  onChange: (time: ContactTime) => void;
  showError: boolean;
}) {
  // «وقت آخر» opens straight away for any saved time that is not one of the quick choices.
  const [other, setOther] = useState(!isPresetTime(value));
  const { hour, minute, period } = splitTime(value);
  const borderColor = showError ? "border-[#b42318]" : "border-[#6c737f]";
  const describedBy = showError ? `${topic}-time-error` : undefined;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 flex items-center gap-2 font-bold text-ink">
        <ClockIcon size={22} className="text-brand-700" />
        اختر الوقت المناسب لك
      </legend>
      <p className="mb-3 text-base text-ink-soft">بتوقيت السعودية</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {presetTimeOptions.map((o) => (
          <ChoiceCard
            key={o.value}
            type="radio"
            name={`${topic}-time`}
            value={o.value}
            checked={!other && value === o.value}
            onChange={() => {
              setOther(false);
              onChange(o.value);
            }}
            title={o.label}
          />
        ))}
        <ChoiceCard
          type="radio"
          name={`${topic}-time`}
          value="other"
          checked={other}
          onChange={() => {
            setOther(true);
            // Keep the time the parent already has; only repair a value we could not read.
            if (value !== joinTime(hour, minute, period)) onChange(joinTime(hour, minute, period));
          }}
          title="وقت آخر"
        />
      </div>

      {other && (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <div>
            <label htmlFor={`${topic}-hour`} className="mb-1 block font-bold text-ink">
              الساعة
            </label>
            <select
              id={`${topic}-hour`}
              value={hour}
              onChange={(e) => onChange(joinTime(Number(e.target.value), minute, period))}
              aria-describedby={describedBy}
              className={`${selectClass} ${borderColor}`}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${topic}-minute`} className="mb-1 block font-bold text-ink">
              الدقيقة
            </label>
            <select
              id={`${topic}-minute`}
              value={minute}
              onChange={(e) => onChange(joinTime(hour, Number(e.target.value), period))}
              aria-describedby={describedBy}
              className={`${selectClass} ${borderColor}`}
            >
              {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${topic}-period`} className="mb-1 block font-bold text-ink">
              الفترة
            </label>
            <select
              id={`${topic}-period`}
              value={period}
              onChange={(e) => onChange(joinTime(hour, minute, e.target.value as Period))}
              aria-describedby={describedBy}
              className={`${selectClass} ${borderColor}`}
            >
              <option value="am">صباحًا</option>
              <option value="pm">مساءً</option>
            </select>
          </div>
        </div>
      )}
      {showError && (
        <p id={`${topic}-time-error`} role="alert" className={`mt-4 ${errorBox}`}>
          اختر وقتًا من الخيارات للمتابعة.
        </p>
      )}
    </fieldset>
  );
}

function ExamDaysSelect({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div>
      <label htmlFor="exams-days" className="mb-2 block font-bold text-ink">
        كم يومًا قبل الاختبار؟
      </label>
      <select
        id="exams-days"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="exams-days-hint"
        className="block min-h-14 w-full rounded-xl border-2 border-[#6c737f] bg-white px-4 text-lg font-bold text-ink focus:border-brand-600"
      >
        {EXAM_DAYS.map((d) => (
          <option key={d} value={d}>
            {examDaysOptionLabel(d)}
          </option>
        ))}
      </select>
      <p id="exams-days-hint" className="mt-2 text-base text-ink-soft">
        اختر أي عدد من 1 إلى 30 يومًا. يمكنك أيضًا الضغط على القائمة وكتابة الرقم.
      </p>
    </div>
  );
}

function DayPicker({
  name,
  legend,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  value: Day;
  onChange: (day: Day) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-bold text-ink">{legend}</legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {dayOptions.map((o) => (
          <ChoiceCard
            key={o.value}
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            title={o.label}
          />
        ))}
      </div>
    </fieldset>
  );
}

function DayOfMonthSelect({ value, onChange }: { value: number; onChange: (day: number) => void }) {
  return (
    <div>
      <label htmlFor="grades-day-of-month" className="mb-2 block font-bold text-ink">
        أي يوم من الشهر؟
      </label>
      <select
        id="grades-day-of-month"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="grades-day-of-month-hint"
        className="block min-h-14 w-32 rounded-xl border-2 border-[#6c737f] bg-white px-4 text-lg font-bold text-ink focus:border-brand-600"
      >
        {DAYS_OF_MONTH.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <p id="grades-day-of-month-hint" className="mt-2 text-base text-ink-soft">
        الملخص يشمل درجات الشهر السابق.
      </p>
    </div>
  );
}

function ReviewList({
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
  onEdit: (step: Step) => void;
}) {
  return (
    <ul className="divide-y divide-mint-200 rounded-xl border border-mint-300">
      {showStudent && (
        <ReviewRow label="الابن أو الابنة" step={1} onEdit={onEdit}>
          <p className="text-lg font-bold text-ink">{student.name}</p>
          <p className="text-base text-ink-soft">{student.grade}</p>
        </ReviewRow>
      )}
      {(["attendance", "exams", "grades"] as const).map((topic) => {
        const s = topicSummary(preferences, topic);
        const was = legacy?.needsReview.find((r) => r.topic === topic);
        return (
          <ReviewRow key={topic} label={s.label} step={topicSteps[topic]} onEdit={onEdit}>
            <p className={`text-lg font-bold ${s.status === "choose" ? "text-[#b42318]" : s.status === "off" ? "text-ink-soft" : "text-ink"}`}>
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
              <dl className="mt-1 space-y-0.5 text-base">
                <SummaryLine term="الطريقة" value={s.method} />
                <SummaryLine term="الموعد" value={s.when} />
                {s.note && <p className="text-ink-soft">{s.note}</p>}
              </dl>
            )}
          </ReviewRow>
        );
      })}
      {showRetry && usesCalls(preferences) && (
        <ReviewRow label="إعادة الاتصال" step={5} onEdit={onEdit}>
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
  step,
  onEdit,
  children,
}: {
  label: string;
  step: Step;
  onEdit: (step: Step) => void;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-bold text-brand-800">{label}</p>
        {children}
      </div>
      <button
        type="button"
        onClick={() => onEdit(step)}
        aria-label={`تعديل ${label}`}
        className="inline-flex min-h-12 shrink-0 items-center justify-center self-start rounded-lg border-2 border-brand-600 bg-white px-6 font-bold text-brand-700 hover:bg-mint-100 sm:self-center"
      >
        تعديل
      </button>
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

function DeliveryNotes({ student }: { student: Student }) {
  return (
    <ul className="space-y-3">
      {[
        `التحديثات المجدولة لـ${student.firstName} تُجمع في اتصال واحد أو رسالة واحدة فقط إذا تطابق التاريخ والوقت وطريقة التواصل.`,
        "التحديثات المباشرة تصلك فور حدوثها، ولا تتأخر لتُجمع مع غيرها.",
        "جميع الأوقات بتوقيت السعودية.",
      ].map((n) => (
        <li key={n} className="flex gap-3 rounded-xl bg-mint-100 p-4 leading-8 text-ink ring-1 ring-mint-300">
          <InfoIcon size={22} className="mt-1.5 shrink-0 text-brand-700" />
          <span>{n}</span>
        </li>
      ))}
    </ul>
  );
}

function LegacyNotice({ legacy, children }: { legacy: LegacyInfo; children?: React.ReactNode }) {
  return (
    <section
      aria-labelledby="legacy-title"
      className="rounded-xl border-2 border-[#b2ddff] bg-[#eff8ff] p-5 leading-8 text-[#194185]"
    >
      <h2 id="legacy-title" className="flex items-center gap-2 text-xl font-bold">
        <InfoIcon size={24} className="shrink-0" />
        تغيّرت خيارات المساعد
      </h2>
      <p className="mt-2">
        أصبح لكل نوع من التحديثات وقته الخاص بدل وقت واحد للجميع. نقلنا ما يطابق اختياراتك السابقة كما هو، واخترنا
        «اتصال» إذا لم تكن قد اخترت طريقة تواصل.
      </p>
      {legacy.notes.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 ps-6">
          {legacy.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {legacy.needsReview.length > 0 && (
        <>
          <p className="mt-2 font-bold">هذه الاختيارات تحتاج إلى اختيار بديل قبل الحفظ:</p>
          <ul className="mt-1 list-disc space-y-1 ps-6">
            {legacy.needsReview.map((r) => (
              <li key={r.topic}>
                {topicLabels[r.topic]}: {r.previousRequest ? <>طلبك السابق <bdi>«{r.was}»</bdi></> : <>كان «{r.was}»</>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2">تبقى اختياراتك السابقة محفوظة كما هي حتى تحفظ الاختيارات الجديدة.</p>
      {children}
    </section>
  );
}

function SavedSummary({
  student,
  preferences,
  legacy,
  justSaved,
  focusPicker,
  onSelectStudent,
  onSaved,
  onEdit,
}: {
  student: Student;
  preferences: Preferences;
  legacy: LegacyInfo | null;
  justSaved: boolean;
  focusPicker: boolean;
  onSelectStudent: (id: string) => void;
  onSaved: () => void;
  onEdit: (step: Step) => void;
}) {
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => {
    // Move focus to the confirmation so keyboard and screen-reader users land on it.
    if (justSaved) confirmationRef.current?.focus();
    else if (focusPicker) pickerRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [justSaved, focusPicker]);

  const firstReview = legacy?.needsReview[0];
  const saveConverted = () => {
    if (savePreferences(student.id, preferences)) {
      setSaveFailed(false);
      onSaved();
    } else {
      setSaveFailed(true);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="saved-student-title">
        <SectionTab id="saved-student-title" title="الابن أو الابنة" size="lg" />
        <div ref={pickerRef} className={`${card} space-y-4`}>
          <StudentPicker
            legend="اختر الابن أو الابنة"
            name="assistant-student"
            selectedId={student.id}
            onSelect={(id) => id !== student.id && onSelectStudent(id)}
          />
        </div>
      </section>

      <section aria-labelledby="saved-title">
        {justSaved ? (
          <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-[#abefc6] bg-[#ecfdf3] p-5" role="status">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#067647] text-white">
              <CheckIcon size={28} strokeWidth={3} />
            </span>
            <div>
              <h2
                id="saved-title"
                ref={confirmationRef}
                tabIndex={-1}
                className="text-2xl font-extrabold text-[#085d3a] focus:outline-none"
              >
                تم حفظ التفضيلات
              </h2>
              <p className="mt-1 text-[#085d3a]">حفظنا اختياراتك الخاصة بـ{student.firstName}.</p>
            </div>
          </div>
        ) : (
          <>
            {legacy && (
              <div className="mb-5">
                <LegacyNotice legacy={legacy}>
                  <div className="mt-4">
                    {firstReview ? (
                      <button type="button" onClick={() => onEdit(topicSteps[firstReview.topic])} className={primaryButton}>
                        اختيار البديل
                      </button>
                    ) : (
                      <button type="button" onClick={saveConverted} className={primaryButton}>
                        حفظ التفضيلات
                      </button>
                    )}
                  </div>
                  {saveFailed && (
                    <p role="alert" className="mt-3 rounded-lg bg-[#fef3f2] px-4 py-3 font-bold text-[#b42318]">
                      {saveErrorText}
                    </p>
                  )}
                </LegacyNotice>
              </div>
            )}
            <SectionTab id="saved-title" title={`تفضيلاتك المحفوظة لـ${student.firstName}`} size="lg" />
          </>
        )}

        <div
          className={`${justSaved ? "rounded-xl border" : "rounded-b-xl border border-t-0"} space-y-5 border-line bg-white p-5 sm:p-6`}
        >
          <ReviewList preferences={preferences} student={student} legacy={legacy} showRetry onEdit={onEdit} />
          <DeliveryNotes student={student} />
          {preferences.savedAt && (
            <p className="text-base text-ink-soft">آخر حفظ: {formatSavedAt(preferences.savedAt)}</p>
          )}
          <DemoSaveNote />
          <Link href="/" className={secondaryButton}>
            العودة إلى الرئيسية
          </Link>
        </div>
      </section>
    </div>
  );
}

function DemoSaveNote() {
  return (
    <p className="flex gap-3 rounded-xl border border-[#b2ddff] bg-[#eff8ff] p-4 text-base leading-7 text-[#194185]">
      <InfoIcon size={22} className="mt-0.5 shrink-0" />
      <span>
        هذا نموذج تجريبي: تُحفظ اختياراتك على هذا الجهاز فقط،{" "}
        <strong>ولم تتم جدولة أو إرسال أي اتصال أو رسالة فعلية.</strong>
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
