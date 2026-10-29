"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { students, type Student } from "@/components/dashboard/data";
import { ClockIcon, InfoIcon, MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { ChoiceCard, StudentPicker, errorBox, primaryButton, secondaryButton } from "@/components/dashboard/ui";
import { AFTER_SCHOOL_TIME } from "./config";
import {
  DAYS_OF_MONTH,
  adaptToStudent,
  allProblems,
  attendanceCustomOptions,
  attendanceTimingOptions,
  dayOptions,
  defaultPreferences,
  enabledTopics,
  pullFromServer,
  EXAM_DAYS,
  examDaysOptionLabel,
  examTimingOptions,
  getTime,
  gradesTimingOptions,
  isEnabled,
  isTimingAvailable,
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
  type ClearedChoice,
  type ContactTime,
  type Period,
  type Day,
  type LegacyInfo,
  type Method,
  type Preferences,
  type Problem,
  type Topic,
  type UnavailableOptions,
} from "./preferences";
import { Character, DeliveryNotes, DemoLabel, ReviewList, type EditTarget } from "./summary";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: Step[] = [1, 2, 3, 4, 5];
const stepTitles: Record<Step, string> = {
  1: "اختر الابن أو الابنة",
  2: "الحضور والغياب",
  3: "تذكير الاختبار",
  4: "ملخص الدرجات",
  5: "مراجعة اختياراتك",
};
/** Short names under the progress bar. */
const stepNames: Record<Step, string> = { 1: "الابن", 2: "الحضور", 3: "الاختبارات", 4: "الدرجات", 5: "المراجعة" };
const topicSteps: Record<Topic, Step> = { attendance: 2, exams: 3, grades: 4 };
const stepTopics: Partial<Record<Step, Topic>> = { 2: "attendance", 3: "exams", 4: "grades" };
const editSteps: Record<EditTarget, Step> = { student: 1, ...topicSteps, retry: 5 };
const timingOptions = { attendance: attendanceTimingOptions, exams: examTimingOptions, grades: gradesTimingOptions };
const timingQuestions: Record<Topic, string> = {
  attendance: "متى يصلك تحديث الحضور؟",
  exams: "متى يصلك تذكير الاختبار؟",
  grades: "متى يصلك ملخص الدرجات؟",
};

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const stepLabel = (step: Step) => `الخطوة ${toArabicDigits(step)} من ${toArabicDigits(STEPS.length)}`;
export const confirmationHref = (studentId: string) => `/assistant/confirmation?student=${studentId}`;

const legendClass = "mb-3 text-xl font-bold text-ink";

const problemText = (problem: Problem) =>
  problem.kind === "time"
    ? `${topicLabels[problem.topic]}: اختر وقتًا من الخيارات، أو حدّد الساعة والدقيقة والفترة في «وقت آخر».`
    : `${topicLabels[problem.topic]}: اختر أحد الخيارات وتأكد من اليوم.`;

/**
 * Next.js keeps visited pages mounted (hidden) and restores their state. Arriving here by a link or
 * after saving starts fresh from the saved choices; browser Back still restores an unsaved draft.
 * Switching student only changes the search params, so it keeps the same id.
 */
export function AssistantSetup() {
  return <Setup key={useRouter().bfcacheId} />;
}

function Setup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const student = students.find((s) => s.id === searchParams.get("student")) ?? students[0];
  const saved = useSavedPreferences(student.id);
  useEffect(() => {
    void pullFromServer(student.id);
  }, [student.id]);
  // A student chosen in step 1 stays on step 1, with focus back on the choice after the remount.
  const [pickedFor, setPickedFor] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  // Choices brought along when the student is changed from the review («تعديل» beside the student).
  const [carried, setCarried] = useState<{
    seq: number;
    studentId: string;
    prefs: Preferences;
    cleared: ClearedChoice[];
  } | null>(null);

  /** `draft` is passed only when changing the student from the review: those choices move to the new student. */
  const selectStudent = (id: string, draft?: Preferences) => {
    setPickedFor(id);
    const next = students.find((s) => s.id === id);
    if (draft && next) {
      const { preferences, cleared } = adaptToStudent(draft, next.assistantUnavailable);
      setCarried((c) => ({ seq: (c?.seq ?? 0) + 1, studentId: id, prefs: preferences, cleared }));
    } else {
      setCarried(null);
    }
    router.replace(`/assistant?student=${id}`, { scroll: false });
  };
  const onSaved = () => {
    setSavedFor(student.id);
    router.push(confirmationHref(student.id));
  };

  const hasSaved = saved.status === "saved";
  const carry = carried?.studentId === student.id ? carried : null;
  // Saved choices are checked against this student's options too.
  const fromSaved = adaptToStudent(hasSaved ? saved.preferences : defaultPreferences, student.assistantUnavailable);
  // Remounting per student (and per saved version) keeps each student's draft separate.
  const wizardKey = `${student.id}:${
    saved.status === "saved" ? `${saved.preferences.savedAt}:${saved.legacy ? "legacy" : "v4"}` : saved.status
  }`;

  return (
    <>
      <section aria-labelledby="page-title" className="bg-mint-200">
        <div className="mx-auto max-w-3xl px-4 pt-5 pb-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <nav aria-label="مسار التنقل" className="text-base">
              <ol className="flex items-center gap-2 text-ink-soft">
                <li>
                  <Link
                    href={`/?student=${student.id}`}
                    className="inline-flex min-h-11 items-center font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
                  >
                    الرئيسية
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">المساعد الذكي</li>
              </ol>
            </nav>
            <DemoLabel />
          </div>
          <h1 id="page-title" className="mt-3 text-3xl leading-tight font-extrabold text-ink">
            إعداد المساعد الذكي
          </h1>
          <p className="mt-2 max-w-2xl text-lg leading-8 text-ink">
            اختر ما تريد معرفته عن أبنائك، ومتى وكيف نتواصل معك.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8 text-lg">
        {savedFor === student.id ? (
          <p role="status" className="py-10 text-center font-bold text-brand-800">
            تم الحفظ. جارٍ فتح صفحة التأكيد…
          </p>
        ) : (
          <Wizard
            key={carry ? `${student.id}:carried:${carry.seq}` : wizardKey}
            student={student}
            initial={carry?.prefs ?? fromSaved.preferences}
            cleared={carry?.cleared ?? fromSaved.cleared}
            legacy={!carry && saved.status === "saved" ? saved.legacy : null}
            hadInvalidData={!carry && saved.status === "invalid"}
            startStep={carry ? 1 : hasSaved && pickedFor !== student.id ? 5 : 1}
            startReturnToReview={carry !== null}
            replacesSaved={carry !== null && saved.status === "saved"}
            focusPicker={pickedFor === student.id}
            cancelHref={hasSaved ? confirmationHref(student.id) : undefined}
            onSelectStudent={selectStudent}
            onSaved={onSaved}
          />
        )}
      </div>
    </>
  );
}

function Wizard({
  student,
  initial,
  cleared,
  legacy,
  hadInvalidData,
  startStep,
  startReturnToReview,
  replacesSaved,
  focusPicker,
  cancelHref,
  onSelectStudent,
  onSaved,
}: {
  student: Student;
  initial: Preferences;
  /** Choices cleared because this student cannot use them. */
  cleared: ClearedChoice[];
  legacy: LegacyInfo | null;
  hadInvalidData: boolean;
  startStep: Step;
  startReturnToReview: boolean;
  /** The choices came from another child and this child already has saved preferences: ask before replacing them. */
  replacesSaved: boolean;
  focusPicker: boolean;
  /** Set when saved preferences exist: leaving without saving returns to them. */
  cancelHref?: string;
  onSelectStudent: (id: string, draft?: Preferences) => void;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [step, setStep] = useState<Step>(startStep);
  // Set when a step is opened from «تعديل»; that step then leads straight back to the review.
  const [returnToReview, setReturnToReview] = useState(startReturnToReview);
  // Errors appear only after the parent tries to continue, so a fresh step is never shown in red.
  const [attempted, setAttempted] = useState<Step[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveErrorsRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const confirmBackRef = useRef<HTMLButtonElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const focusPending = useRef(false);

  useEffect(() => {
    if (focusPicker) bodyRef.current?.querySelector<HTMLInputElement>("input[name=assistant-student]:checked")?.focus();
  }, [focusPicker]);

  useEffect(() => {
    // Only after the parent moves between steps, so the first page load keeps its natural focus.
    if (!focusPending.current) return;
    focusPending.current = false;
    sectionRef.current?.scrollIntoView({ block: "start" });
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
  const editFromReview = (target: EditTarget) => {
    const next = editSteps[target];
    setReturnToReview(next !== 5);
    goTo(next);
  };

  const problems = allProblems(prefs);
  const noneEnabled = enabledTopics(prefs).length === 0;
  const store = () => {
    if (savePreferences(student.id, prefs)) {
      setSaveFailed(false);
      onSaved();
    } else {
      setSaveFailed(true);
    }
  };
  const save = () => {
    if (problems.length > 0 || noneEnabled) {
      setAttempted([2, 3, 4, 5]);
      saveErrorsRef.current?.scrollIntoView({ block: "center" });
      saveErrorsRef.current?.focus({ preventScroll: true });
      return;
    }
    if (replacesSaved) {
      confirmRef.current?.showModal();
      // The safe choice gets focus first; Escape does the same as it.
      confirmBackRef.current?.focus();
      return;
    }
    store();
  };

  const topic = stepTopics[step];
  const showSaveErrors = attempted.includes(5) || noneEnabled;
  const needsReplacement = cleared.filter((c) => prefs[c.topic].timing === null);
  const guide: Record<Step, string> = {
    1: "نضبط التحديثات لابن واحد في كل مرة، ولكل ابن اختياراته الخاصة.",
    2: `اختر متى وكيف يصلك خبر حضور ${student.firstName} وغيابه.`,
    3: `اختر متى نذكّرك باختبارات ${student.firstName}، وكيف.`,
    4: `اختر متى يصلك ملخص درجات ${student.firstName}، وكيف.`,
    5: "تأكد من اختياراتك، ثم اضغط «حفظ التفضيلات» في الأسفل.",
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="wizard-heading"
      className="scroll-mt-4 overflow-hidden rounded-xl border border-line bg-white"
    >
      <Progress step={step} />

      <div ref={bodyRef} className="space-y-8 p-5 sm:p-8">
        <div className="flex items-start gap-4 sm:gap-6">
          <Character kind={step === 1 ? "both" : student.character} className="size-20 sm:size-28" />
          <div className="min-w-0 pt-1 sm:pt-3">
            <h2
              id="wizard-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl leading-snug font-extrabold text-ink sm:text-[28px]"
            >
              <span className="sr-only">{stepLabel(step)}: </span>
              {stepTitles[step]}
            </h2>
            <p className="mt-2 leading-8 text-ink">{guide[step]}</p>
          </div>
        </div>

        {(step === 1 || step === 5) && hadInvalidData && (
          <p className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[#7a2e0e]">
            <InfoIcon size={24} className="mt-1 shrink-0" />
            تعذّرت قراءة الاختيارات المحفوظة سابقًا على هذا الجهاز، لذلك عرضنا الاختيارات المقترحة. اضغط «حفظ التفضيلات» في
            الخطوة الأخيرة لحفظها من جديد.
          </p>
        )}
        {(step === 1 || step === 5) && legacy && <LegacyNotice legacy={legacy} />}
        {(step === 1 || step === 5) && needsReplacement.length > 0 && (
          <div role="status" className="rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 leading-8 text-[#7a2e0e]">
            <p className="flex gap-3 font-bold">
              <InfoIcon size={24} className="mt-1 shrink-0" />
              هذه الاختيارات غير متاحة لـ{student.firstName}:
            </p>
            <ul className="mt-1 list-disc space-y-1 ps-14">
              {needsReplacement.map((c) => (
                <li key={c.topic}>
                  {topicLabels[c.topic]}: «{c.was}»
                </li>
              ))}
            </ul>
            <p className="mt-1 ps-9">بقية اختياراتك كما هي. اختر بديلًا لكل منها قبل الحفظ.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <StudentPicker
              legend="اختر الابن أو الابنة"
              name="assistant-student"
              selectedId={student.id}
              onSelect={(id) => id !== student.id && onSelectStudent(id, returnToReview ? prefs : undefined)}
            />
            <p className="text-base leading-7 text-ink-soft">
              {returnToReview
                ? "تبقى اختياراتك في الخطوات الأخرى كما هي، وتُحفظ للابن الذي تختاره عند الضغط على «حفظ التفضيلات»."
                : "عند اختيار ابن آخر تظهر اختياراته هو. التغييرات التي لم تحفظها لا تُنقل إليه."}
            </p>
          </div>
        )}

        {topic && (
          <TopicStep
            topic={topic}
            prefs={prefs}
            setPrefs={setPrefs}
            showErrors={attempted.includes(step)}
            previous={legacy?.needsReview.find((r) => r.topic === topic)}
            unavailable={student.assistantUnavailable}
            unavailableWas={cleared.find((c) => c.topic === topic)?.was}
            firstName={student.firstName}
          />
        )}

        {step === 5 && (
          <div className="space-y-8">
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

            {usesCalls(prefs) && (
              <fieldset className="min-w-0">
                <legend className={legendClass}>إذا لم ترد على الاتصال</legend>
                <ChoiceCard
                  type="checkbox"
                  name="retry"
                  value="retry"
                  checked={prefs.retryUnansweredCall}
                  onChange={() => setPrefs((p) => ({ ...p, retryUnansweredCall: !p.retryUnansweredCall }))}
                  title="إذا لم أرد، أعد الاتصال مرة واحدة بعد ٥ دقائق"
                  description="اختياري. للاتصالات التي لم يُرد عليها فقط، ولا ينطبق على الرسائل."
                />
              </fieldset>
            )}

            <section aria-labelledby="review-notes" className="space-y-4">
              <h3 id="review-notes" className="text-xl font-bold text-ink">
                معلومات مهمة
              </h3>
              <DeliveryNotes student={student} />
            </section>

            {saveFailed && (
              <p role="alert" className={errorBox}>
                تعذّر الحفظ على هذا الجهاز، فلم تُحفظ اختياراتك. تأكد أن المتصفح يسمح بحفظ البيانات، ثم اضغط «حفظ التفضيلات» مرة
                أخرى.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-mint-200 pt-6">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            {step > 1 && !returnToReview ? (
              <button type="button" onClick={() => goTo((step - 1) as Step)} className={secondaryButton}>
                السابق
              </button>
            ) : (
              <span className="hidden sm:block" />
            )}
            {step === 5 ? (
              <button ref={saveButtonRef} type="button" onClick={save} className={primaryButton}>
                حفظ التفضيلات
              </button>
            ) : (
              <button type="button" onClick={goNext} className={primaryButton}>
                {returnToReview ? "العودة إلى المراجعة" : "التالي"}
              </button>
            )}
          </div>
          {replacesSaved && (
            <dialog
              ref={confirmRef}
              aria-labelledby="replace-title"
              aria-describedby="replace-desc"
              // Closing by any route (back button, Escape) returns the parent to the save button.
              onClose={() => saveButtonRef.current?.focus()}
              className="m-auto w-[min(92vw,30rem)] rounded-2xl border border-line bg-white p-0 text-ink shadow-xl"
            >
              <h2 id="replace-title" className="bg-mint-200 px-5 py-4 text-xl font-bold text-brand-800">
                استبدال تفضيلات {student.firstName}؟
              </h2>
              <div className="space-y-5 px-5 py-5 text-lg">
                <p id="replace-desc" className="leading-8 text-ink">
                  لدى {student.firstName} تفضيلات محفوظة على هذا الجهاز. الحفظ الآن يستبدلها بالاختيارات التي في هذه المراجعة،
                  ولا تتغير تفضيلات أي ابن آخر.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      confirmRef.current?.close();
                      store();
                    }}
                    className={primaryButton}
                  >
                    نعم، احفظ واستبدل
                  </button>
                  <button
                    ref={confirmBackRef}
                    type="button"
                    onClick={() => confirmRef.current?.close()}
                    className={secondaryButton}
                  >
                    رجوع دون حفظ
                  </button>
                </div>
              </div>
            </dialog>
          )}
          {cancelHref && (
            <p className="mt-5 text-center">
              <Link
                href={cancelHref}
                className="inline-flex min-h-11 items-center px-3 font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                إلغاء التعديل والعودة إلى التفضيلات المحفوظة
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** «الخطوة ٢ من ٥» with a five-part bar; each part is named on wider screens and for screen readers. */
function Progress({ step }: { step: Step }) {
  return (
    <div className="border-b border-mint-200 bg-mint-50 px-5 py-4 sm:px-8">
      <p aria-hidden="true" className="font-bold text-brand-800">
        {stepLabel(step)}
      </p>
      <ol aria-label="خطوات الإعداد" className="mt-3 grid grid-cols-5 gap-2">
        {STEPS.map((n) => (
          <li key={n} aria-current={n === step ? "step" : undefined}>
            <span aria-hidden="true" className={`block h-2.5 rounded-full ${n <= step ? "bg-brand-600" : "bg-mint-300"}`} />
            <span
              className={`sr-only text-base sm:not-sr-only sm:mt-2 sm:block ${
                n === step ? "font-bold text-ink" : "text-ink-soft"
              }`}
            >
              {stepNames[n]}
              {n < step && <span className="sr-only"> (تمت)</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type SetPrefs = React.Dispatch<React.SetStateAction<Preferences>>;

function TopicStep({
  topic,
  prefs,
  setPrefs,
  showErrors,
  previous,
  unavailable,
  unavailableWas,
  firstName,
}: {
  topic: Topic;
  prefs: Preferences;
  setPrefs: SetPrefs;
  showErrors: boolean;
  previous?: LegacyInfo["needsReview"][number];
  unavailable?: UnavailableOptions;
  /** The cleared choice's name, when it was cleared because this student cannot use it. */
  unavailableWas?: string;
  firstName: string;
}) {
  const timing = prefs[topic].timing;
  const enabled = isEnabled(prefs, topic);
  const problem = showErrors ? problemsFor(prefs, topic)[0] : undefined;
  const invalid = problem?.kind === "choose";

  const patch = (change: Record<string, unknown>) =>
    setPrefs((p) => ({ ...p, [topic]: { ...p[topic], ...change } }) as Preferences);
  const patchCustom = (change: Partial<Preferences["attendance"]["custom"]>) =>
    setPrefs((p) => ({ ...p, attendance: { ...p.attendance, custom: { ...p.attendance.custom, ...change } } }));

  return (
    <div className="space-y-8">
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
      {!previous && unavailableWas && timing === null && (
        <p className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 font-bold text-[#7a2e0e]">
          <InfoIcon size={22} className="mt-1 shrink-0" />
          <span>
            «{unavailableWas}» غير متاح لـ{firstName}. اختر بديلًا من الخيارات التالية.
          </span>
        </p>
      )}

      <fieldset className="min-w-0" aria-describedby={invalid ? `${topic}-timing-error` : undefined}>
        <legend className={legendClass}>{timingQuestions[topic]}</legend>
        <div className="grid gap-3">
          {timingOptions[topic]
            .filter((o) => isTimingAvailable(unavailable, topic, o.value))
            .map((o) => (
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
        <div className="space-y-6">
          <fieldset className="min-w-0">
            <legend className={legendClass}>ما نوع الملخص الذي تريده؟</legend>
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

      {enabled && (
        <div className="space-y-8 border-t border-mint-200 pt-8">
          <MethodPicker topic={topic} value={prefs[topic].method} onChange={(method) => patch({ method })} />
          {needsTime(prefs, topic) && (
            <TimePicker
              topic={topic}
              value={getTime(prefs, topic)}
              onChange={(time) => (topic === "attendance" ? patchCustom({ time }) : patch({ time }))}
              showError={problem?.kind === "time"}
            />
          )}
          <TopicResult topic={topic} prefs={prefs} />
        </div>
      )}
    </div>
  );
}

/** What these choices produce, in one sentence, with the rules that come with them. */
function TopicResult({ topic, prefs }: { topic: Topic; prefs: Preferences }) {
  const timing = prefs[topic].timing;
  const summary = topicSummary(prefs, topic);
  const rules: string[] = [];
  if (topic === "attendance") {
    if (timing === "immediate") {
      rules.push("لا يوجد وقت محدد: يصلك التواصل عند تسجيل الحضور أو الغياب أو التأخر، وليس عند الغياب فقط.");
    }
    if (timing === "end-of-day") {
      rules.push(`الساعة ${AFTER_SCHOOL_TIME.label} وقت ثابت افتراضي للنموذج التجريبي، وليس وقت انصراف رسميًا.`);
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
    <section aria-labelledby={`${topic}-result`} className="rounded-xl bg-mint-100 p-5">
      <h3 id={`${topic}-result`} className="font-bold text-brand-800">
        ما الذي سيصلك
      </h3>
      <p aria-live="polite" className="mt-1 text-lg leading-8 font-bold text-ink">
        {summary.method}: {summary.when}
      </p>
      <ul className="mt-3 list-disc space-y-1.5 ps-6 text-base leading-7 text-ink marker:text-brand-600">
        {rules.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

function MethodPicker({ topic, value, onChange }: { topic: Topic; value: Method; onChange: (method: Method) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className={legendClass}>كيف يصلك؟</legend>
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
              leading={<Icon size={28} className="shrink-0 text-brand-700" />}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

const selectClass =
  "block min-h-14 w-full cursor-pointer rounded-xl border-2 bg-white px-3 text-lg font-bold text-ink focus:border-brand-600";

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
      <legend className="mb-1 flex items-center gap-2 text-xl font-bold text-ink">
        <ClockIcon size={24} className="text-brand-700" />
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
      <label htmlFor="exams-days" className="mb-2 block text-xl font-bold text-ink">
        كم يومًا قبل الاختبار؟
      </label>
      <select
        id="exams-days"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="exams-days-hint"
        className="block min-h-14 w-full cursor-pointer rounded-xl border-2 border-[#6c737f] bg-white px-4 text-lg font-bold text-ink focus:border-brand-600 sm:max-w-sm"
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
      <legend className={legendClass}>{legend}</legend>
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
      <label htmlFor="grades-day-of-month" className="mb-2 block text-xl font-bold text-ink">
        أي يوم من الشهر؟
      </label>
      <select
        id="grades-day-of-month"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby="grades-day-of-month-hint"
        className="block min-h-14 w-32 cursor-pointer rounded-xl border-2 border-[#6c737f] bg-white px-4 text-lg font-bold text-ink focus:border-brand-600"
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

function LegacyNotice({ legacy }: { legacy: LegacyInfo }) {
  return (
    <section
      aria-labelledby="legacy-title"
      className="rounded-xl border-2 border-[#b2ddff] bg-[#eff8ff] p-5 leading-8 text-[#194185]"
    >
      <h3 id="legacy-title" className="flex items-center gap-2 text-xl font-bold">
        <InfoIcon size={24} className="shrink-0" />
        تغيّرت خيارات المساعد
      </h3>
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
    </section>
  );
}
