"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { savePreferencesToDb, useLinkedStudents, useStudentPreferences, type LinkedStudent } from "@/lib/tammeni/parent-data";
import { CheckIcon, ClockIcon, InfoIcon } from "@/components/dashboard/icons";
import { ChildSwitcher, Choice, LoadProblem, Placeholder, childTone } from "@/components/dashboard/ui";
import {
  DAYS_OF_MONTH,
  EXAM_DAYS,
  adaptToStudent,
  allProblems,
  attendanceCustomOptions,
  attendanceTimingOptions,
  dayOptions,
  defaultPreferences,
  enabledTopics,
  examDaysOptionLabel,
  examTimingOptions,
  getTime,
  gradesTimingOptions,
  isPresetTime,
  joinTime,
  presetTimeOptions,
  problemsFor,
  splitTime,
  topicLabels,
  topicSummary,
  topics,
  usesCalls,
  useSavedPreferences,
  type ClearedChoice,
  type ContactTime,
  type Day,
  type LegacyInfo,
  type Period,
  type Preferences,
  type Topic,
} from "./preferences";
import { topicIcons } from "./summary";

export const confirmationHref = (studentId: string) => `/assistant/confirmation?student=${studentId}`;

const container = "mx-auto w-full max-w-[1100px] px-4 sm:px-6";
const timingOptions = { attendance: attendanceTimingOptions, exams: examTimingOptions, grades: gradesTimingOptions };
const firstTiming: Record<Topic, Preferences[Topic]["timing"]> = { attendance: "immediate", exams: "day-before", grades: "monthly" };
const guidedLabels = topicLabels;
const guidedAbout: Record<Topic, string> = {
  attendance: "تنبيهات عن تسجيل الحضور والغياب والتأخر.",
  exams: "تذكير قبل موعد الاختبار أو عند إلغائه.",
  grades: "تنبيه بالدرجات الجديدة أو ملخص شهري.",
};

/**
 * Next.js keeps visited pages mounted (hidden) and restores their state. Arriving here by a link or
 * after saving starts fresh from the saved choices; browser Back still restores an unsaved draft.
 */
export function AssistantSetup() {
  return <Setup key={useRouter().bfcacheId} />;
}

function Setup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The parent's children and saved preferences come from Supabase, as the signed-in parent.
  const linked = useLinkedStudents();
  const list = linked.status === "ready" ? linked.data : [];
  const student = list.find((s) => s.id === searchParams.get("student")) ?? list[0] ?? null;
  const dbPrefs = useStudentPreferences(student?.dbId ?? null);
  // A record from the earlier browser-only version, for the same child. Read only; never deleted here.
  const local = useSavedPreferences(student?.id ?? "-");
  // The parent chose to bring that record in (it is saved to the account only on «حفظ التفضيلات»).
  const [bringLocalFor, setBringLocalFor] = useState<string | null>(null);
  const [savedFor, setSavedFor] = useState<string | null>(null);
  // Unsaved changes for the child on screen; switching child asks first.
  const dirty = useRef(false);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);
  const [switchCancelCount, setSwitchCancelCount] = useState(0);
  const switchDialog = useRef<HTMLDialogElement>(null);
  const stayButton = useRef<HTMLButtonElement>(null);

  const goToStudent = (id: string) => {
    dirty.current = false;
    router.replace(`/assistant?student=${id}`, { scroll: false });
  };
  const selectStudent = (id: string) => {
    if (!student || id === student.id) return;
    if (!dirty.current) return goToStudent(id);
    setPendingSwitch(id);
    switchDialog.current?.showModal();
    stayButton.current?.focus();
  };
  const onSaved = () => {
    if (!student) return;
    dirty.current = false;
    setSavedFor(student.id);
    router.push(confirmationHref(student.id));
  };

  const pendingName = list.find((s) => s.id === pendingSwitch)?.firstName;

  return (
    <>
      <section aria-labelledby="page-title" className={`${container} pt-8 sm:pt-10`}>
        <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 id="page-title" className="text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
              {student ? `تنبيهات ${student.firstName}` : "تفضيلات التنبيه"}
            </h1>
          </div>
        </div>
      </section>

      <div className={`${container} mt-6 pb-10`}>
        {linked.status === "error" ? (
          <LoadProblem title="تعذّر تحميل قائمة الأبناء" message={linked.message} onRetry={linked.reload} />
        ) : linked.status === "loading" ? (
          <SetupLoading />
        ) : !student ? (
          <LoadProblem message="ما فيه أبناء مرتبطين بهذا الحساب بعد." />
        ) : savedFor === student.id ? (
          <p role="status" className="flex items-center gap-3 py-10 font-semibold text-brand-ink">
            <span className="spinner" aria-hidden="true" />
            تم الحفظ. جارٍ فتح الملخص…
          </p>
        ) : dbPrefs.status === "error" ? (
          // Never fall back to the defaults: they would look like the parent's saved choices.
          <LoadProblem title={`تعذّر تحميل تفضيلات ${student.firstName}`} message={dbPrefs.message} onRetry={dbPrefs.reload} />
        ) : dbPrefs.status === "loading" ? (
          <SetupLoading />
        ) : (
          (() => {
            const hasSaved = dbPrefs.data.exists;
            const bringingLocal = !hasSaved && bringLocalFor === student.id && local.status === "saved";
            const base = bringingLocal ? local.preferences : dbPrefs.data.exists ? dbPrefs.data.preferences : defaultPreferences;
            const fromSaved = adaptToStudent(base, undefined);
            // Remounting per student (and per saved version) keeps each student's draft separate.
            const editorKey = `${student.id}:${dbPrefs.data.exists ? dbPrefs.data.updatedAt : "none"}:${bringingLocal ? "local" : ""}`;
            return (
              <>
                {!hasSaved && !bringingLocal && local.status === "saved" && (
                  <BringLocalOffer firstName={student.firstName} onUse={() => setBringLocalFor(student.id)} />
                )}
                <Editor
                  key={editorKey}
                  student={student}
                  students={list}
                  switchCancelCount={switchCancelCount}
                  savedExists={hasSaved}
                  studentChosen={searchParams.get("student") === student.id}
                  initial={fromSaved.preferences}
                  cleared={fromSaved.cleared}
                  legacy={bringingLocal ? local.legacy : null}
                  onSelectStudent={selectStudent}
                  onDirtyChange={(d) => {
                    dirty.current = d;
                  }}
                  onSaved={onSaved}
                />
              </>
            );
          })()
        )}
      </div>

      <dialog
        ref={switchDialog}
        aria-labelledby="switch-title"
        aria-describedby="switch-desc"
        onClose={() => {
          setPendingSwitch(null);
          setSwitchCancelCount((count) => count + 1);
        }}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl bg-surface p-6 text-ink shadow-xl"
      >
        <h2 id="switch-title" className="text-[1.25rem] font-bold">
          عندك تغييرات ما حفظتها
        </h2>
        <p id="switch-desc" className="mt-2 leading-8 text-ink-soft">
          تغييراتك على تنبيهات {student?.firstName} ما حُفظت. إذا انتقلت إلى {pendingName} بتضيع.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
          <button ref={stayButton} type="button" className="btn-primary" onClick={() => switchDialog.current?.close()}>
            البقاء هنا
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              const id = pendingSwitch;
              switchDialog.current?.close();
              if (id) goToStudent(id);
            }}
          >
            تجاهل التغييرات والانتقال
          </button>
        </div>
      </dialog>
    </>
  );
}

type GuidedStep =
  | { id: string; kind: "student" }
  | { id: string; kind: "review" }
  | { id: string; kind: "enabled" | "method" | "timing"; topic: Topic };

function guidedSteps(prefs: Preferences, editTopic: Topic | null, includeStudent: boolean): GuidedStep[] {
  const steps: GuidedStep[] = [];
  if (includeStudent) steps.push({ id: "student", kind: "student" });
  for (const topic of editTopic ? [editTopic] : topics) {
    steps.push({ id: `${topic}:enabled`, kind: "enabled", topic });
    if (prefs[topic].timing !== "off") {
      steps.push({ id: `${topic}:method`, kind: "method", topic });
      steps.push({ id: `${topic}:timing`, kind: "timing", topic });
    }
  }
  steps.push({ id: "review", kind: "review" });
  return steps;
}

const enabledQuestion: Record<Topic, string> = {
  attendance: "تبي يوصلك خبر الحضور والغياب؟",
  exams: "تبي نذكّرك بالاختبارات؟",
  grades: "تبي يوصلك خبر الدرجات؟",
};

function Editor({
  student,
  students,
  switchCancelCount,
  savedExists,
  studentChosen,
  initial,
  cleared,
  legacy,
  onDirtyChange,
  onSelectStudent,
  onSaved,
}: {
  student: LinkedStudent;
  students: LinkedStudent[];
  switchCancelCount: number;
  savedExists: boolean;
  studentChosen: boolean;
  initial: Preferences;
  cleared: ClearedChoice[];
  legacy: LegacyInfo | null;
  onDirtyChange: (dirty: boolean) => void;
  onSelectStudent: (id: string) => void;
  onSaved: () => void;
}) {
  const [prefs, setPrefs] = useState<Preferences>(initial);
  // A new parent starts from the suggested choices, ready to save; each topic can still be changed step by step.
  const [mode, setMode] = useState<"summary" | "wizard">("summary");
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [stepId, setStepId] = useState("student");
  const [studentSelection, setStudentSelection] = useState({ id: student.id, cancelCount: switchCancelCount });
  const [lastTiming, setLastTiming] = useState<Record<Topic, Preferences[Topic]["timing"]>>({
    attendance: initial.attendance.timing === "off" ? firstTiming.attendance : initial.attendance.timing,
    exams: initial.exams.timing === "off" ? firstTiming.exams : initial.exams.timing,
    grades: initial.grades.timing === "off" ? firstTiming.grades : initial.grades.timing,
  });
  const [attemptedTopic, setAttemptedTopic] = useState<Topic | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const lastView = useRef(`${mode}/${stepId}/${editTopic}`);
  useEffect(() => {
    // Move focus only when the view changes, never on page load.
    const view = `${mode}/${stepId}/${editTopic}`;
    if (view === lastView.current) return;
    lastView.current = view;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [mode, stepId, editTopic]);
  const steps = guidedSteps(prefs, editTopic, !savedExists && !studentChosen && editTopic === null);
  const stepIndex = Math.max(0, steps.findIndex((step) => step.id === stepId));
  const current = steps[stepIndex];
  const selectedStudentId = studentSelection.cancelCount === switchCancelCount ? studentSelection.id : student.id;
  const topic = current.kind === "student" || current.kind === "review" ? null : current.topic;
  const topicProblem = topic && current.kind === "timing" && attemptedTopic === topic ? problemsFor(prefs, topic)[0] : undefined;

  const updatePrefs = (update: (previous: Preferences) => Preferences) => {
    setPrefs(update);
    setValidationMessage(null);
    setSaveFailed(false);
  };

  const setTopicEnabled = (targetTopic: Topic, enabled: boolean) => {
    const timing = prefs[targetTopic].timing;
    if (!enabled) {
      if (timing !== "off" && timing !== null) setLastTiming((previous) => ({ ...previous, [targetTopic]: timing }));
      updatePrefs((previous) => ({ ...previous, [targetTopic]: { ...previous[targetTopic], timing: "off" } }) as Preferences);
      return;
    }
    if (timing === "off") {
      const restored = lastTiming[targetTopic];
      updatePrefs((previous) => ({
        ...previous,
        [targetTopic]: { ...previous[targetTopic], timing: restored && restored !== "off" ? restored : firstTiming[targetTopic] },
      }) as Preferences);
    }
  };

  const patchTopic = (targetTopic: Topic, change: Record<string, unknown>) =>
    updatePrefs((previous) => ({ ...previous, [targetTopic]: { ...previous[targetTopic], ...change } }) as Preferences);
  const patchAttendanceCustom = (change: Partial<Preferences["attendance"]["custom"]>) =>
    updatePrefs((previous) => ({ ...previous, attendance: { ...previous.attendance, custom: { ...previous.attendance.custom, ...change } } }));

  const focusTopicProblem = (targetTopic: Topic, kind: "choose" | "time") => {
    const selector = kind === "time"
      ? `#${targetTopic}-hour, input[name="${targetTopic}-time"]`
      : `input[name="${targetTopic}-timing"]`;
    const target = formRef.current?.querySelector<HTMLElement>(selector);
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  };

  const save = async () => {
    if (saving || (savedExists && !dirty)) return;
    const problems = allProblems(prefs);
    if (problems.length > 0 || enabledTopics(prefs).length === 0) {
      const firstProblem = problems[0];
      const targetTopic = firstProblem?.topic ?? editTopic ?? "attendance";
      setValidationMessage(
        firstProblem
          ? `أكمل اختيار ${guidedLabels[firstProblem.topic]} قبل الحفظ.`
          : "اختر نوعًا واحدًا على الأقل من التنبيهات.",
      );
      setAttemptedTopic(targetTopic);
      if (editTopic !== null) setEditTopic(targetTopic);
      setMode("wizard");
      setStepId(firstProblem ? `${targetTopic}:timing` : `${targetTopic}:enabled`);
      if (firstProblem) focusTopicProblem(targetTopic, firstProblem.kind);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    const result = await savePreferencesToDb(student.dbId, prefs, savedExists);
    if (result.ok) {
      onSaved();
    } else {
      setSaving(false);
      setSaveFailed(true);
    }
  };

  const goToTopic = (targetTopic: Topic) => {
    setEditTopic(targetTopic);
    setStepId(`${targetTopic}:enabled`);
    setAttemptedTopic(null);
    setValidationMessage(null);
    setMode("wizard");
  };

  const goNext = () => {
    if (saving) return;
    if (current.kind === "student" && selectedStudentId !== student.id) {
      onSelectStudent(selectedStudentId);
      return;
    }
    if (current.kind === "timing") {
      const problem = problemsFor(prefs, current.topic)[0];
      if (problem) {
        setAttemptedTopic(current.topic);
        focusTopicProblem(current.topic, problem.kind);
        return;
      }
    }
    const next = steps[stepIndex + 1];
    if (next) {
      setStepId(next.id);
      setAttemptedTopic(null);
      setValidationMessage(null);
    }
  };

  const goPrevious = () => {
    if (saving) return;
    if (editTopic !== null && current.id === `${editTopic}:enabled`) {
      setMode("summary");
      setEditTopic(null);
      setAttemptedTopic(null);
      setValidationMessage(null);
      return;
    }
    const previous = steps[stepIndex - 1];
    if (previous) {
      setStepId(previous.id);
      setAttemptedTopic(null);
      setValidationMessage(null);
    }
  };

  const heading = current.kind === "student"
    ? "اختيار الابن أو الابنة"
    : current.kind === "review"
      ? "مراجعة وحفظ"
      : current.kind === "enabled"
        ? enabledQuestion[current.topic]
        : current.kind === "method"
          ? `كيف يوصلك خبر ${guidedLabels[current.topic]}؟`
          : current.topic === "exams"
            ? "متى نذكّرك بالاختبار؟"
            : `متى يوصلك خبر ${guidedLabels[current.topic]}؟`;
  const progressTopic = topic ? guidedLabels[topic] : current.kind === "review" ? "آخر خطوة" : "اختيار الابن أو الابنة";

  return (
    <div ref={formRef} className="mx-auto w-full max-w-3xl">
      {legacy && mode === "summary" && <LegacyNotice legacy={legacy} />}
      {mode === "summary" ? (
        <section aria-labelledby="summary-heading" className="sheet p-5 sm:p-8">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 ref={headingRef} id="summary-heading" tabIndex={-1} className="text-[1.5rem] leading-tight font-bold focus:outline-none sm:text-[1.75rem]">
                كيف يوصلك الخبر عن {student.firstName}
              </h2>
              {!dirty && students.length > 1 && (
                <div className="mt-3">
                  <ChildSwitcher students={students} selectedId={student.id} onSelect={onSelectStudent} name="assistant-summary-student" legend="عرض تفضيلات" />
                </div>
              )}
            </div>
            <span className="chip shrink-0 self-start sm:self-center" data-tone={dirty ? "warn" : savedExists ? "ok" : "neutral"}>
              {dirty ? "لم تُحفظ التغييرات" : savedExists ? "محفوظة" : "لم تُحفظ بعد"}
            </span>
          </div>

          <TopicReviewList prefs={prefs} onEdit={goToTopic} />
          <CallRetryOption prefs={prefs} onChange={(retryUnansweredCall) => updatePrefs((previous) => ({ ...previous, retryUnansweredCall }))} />
          {saveFailed && (
            <p role="alert" className="notice notice-danger mt-5">
              ما قدرنا نحفظ. اختياراتك باقية، جرّب مرة ثانية.
            </p>
          )}
          {validationMessage && <p role="alert" className="mt-4 font-semibold text-danger">{validationMessage}</p>}
          {/* While there is something to save, the save button stays in view on phones. */}
          <div className={`mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between ${!savedExists || dirty ? "sticky-save sticky bottom-0 z-10 -mx-5 bg-surface px-5 pb-4 sm:static sm:mx-0 sm:px-0 sm:pb-0" : ""}`}>
            <p role="status" className="text-[0.9375rem] leading-6 text-ink-soft">
              {dirty ? "راجع التغييرات قبل حفظها." : savedExists ? "تقدر تعدّل كل موضوع على حدة." : "هذا اقتراحنا. عدّل اللي تبي، ثم احفظ."}
            </p>
            {(!savedExists || dirty) && (
              <button type="button" className="btn-primary w-full sm:w-auto" onClick={save} disabled={saving} aria-busy={saving || undefined}>
                {saving ? <><span className="spinner" aria-hidden="true" /> جارٍ الحفظ…</> : saveFailed ? "إعادة المحاولة" : "حفظ التفضيلات"}
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border border-line bg-surface px-5 py-4" aria-live="polite">
            <div className="flex items-center justify-between gap-4 text-[0.9375rem] font-semibold text-ink-soft">
              <span>الخطوة {stepIndex + 1} من {steps.length}</span>
              <span className="truncate text-brand-ink">{progressTopic}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-strong" aria-hidden="true">
              <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
            </div>
          </div>

          <section aria-labelledby="wizard-question" className="sheet p-5 sm:p-8">
            <div className="mb-6 border-b border-line pb-5">
              <h2 ref={headingRef} id="wizard-question" tabIndex={-1} className="text-[1.5rem] leading-tight font-bold focus:outline-none sm:text-[1.875rem]">
                {heading}
              </h2>
              {current.kind === "enabled" && <p className="mt-2 text-[1.0625rem] leading-8 text-ink-soft">{guidedAbout[current.topic]}</p>}
            </div>

            {current.kind === "student" && (
              <fieldset className="space-y-3">
                <legend className="mb-3 text-lg font-semibold">اختر الابن أو الابنة لهذه التفضيلات</legend>
                {students.map((child, index) => (
                  <LargeChoice
                    key={child.id}
                    name="assistant-student-choice"
                    value={child.id}
                    checked={selectedStudentId === child.id}
                    onChange={() => setStudentSelection({ id: child.id, cancelCount: switchCancelCount })}
                    title={child.firstName}
                    hint={child.grade}
                    leading={<span className="avatar !size-11" data-tone={childTone(index)} aria-hidden="true">{child.firstName.slice(0, 1)}</span>}
                  />
                ))}
              </fieldset>
            )}

            {current.kind === "enabled" && (
              <fieldset className="space-y-3">
                <legend className="sr-only">{heading}</legend>
                <LargeChoice
                  name={`${current.topic}-enabled`}
                  value="yes"
                  checked={prefs[current.topic].timing !== "off"}
                  onChange={() => setTopicEnabled(current.topic, true)}
                  title="نعم"
                />
                <LargeChoice
                  name={`${current.topic}-enabled`}
                  value="no"
                  checked={prefs[current.topic].timing === "off"}
                  onChange={() => setTopicEnabled(current.topic, false)}
                  title="لا"
                  hint={topics.every((t) => t === current.topic || prefs[t].timing === "off") ? "لازم يبقى نوع واحد على الأقل." : undefined}
                />
              </fieldset>
            )}

            {current.kind === "method" && (
              <fieldset className="space-y-3">
                <legend className="sr-only">{heading}</legend>
                <LargeChoice
                  name={`${current.topic}-method`}
                  value="message"
                  checked={prefs[current.topic].method === "message"}
                  onChange={() => patchTopic(current.topic, { method: "message" })}
                  title="رسالة نصية"
                  hint="رسالة قصيرة على جوالك."
                />
                <LargeChoice
                  name={`${current.topic}-method`}
                  value="call"
                  checked={prefs[current.topic].method === "call"}
                  onChange={() => patchTopic(current.topic, { method: "call" })}
                  title="اتصال"
                  hint="لولوة تتصل عليك وتقول لك الخبر."
                />
              </fieldset>
            )}

            {current.kind === "timing" && (
              <TimingQuestion
                topic={current.topic}
                prefs={prefs}
                patchTopic={patchTopic}
                patchAttendanceCustom={patchAttendanceCustom}
                problem={topicProblem}
                previous={legacy?.needsReview.find((item) => item.topic === current.topic)}
                clearedWas={cleared.find((item) => item.topic === current.topic)?.was}
              />
            )}

            {current.kind === "review" && (
              <div>
                {legacy && <LegacyNotice legacy={legacy} />}
                <TopicReviewList prefs={prefs} onEdit={goToTopic} />
                <CallRetryOption prefs={prefs} onChange={(retryUnansweredCall) => updatePrefs((previous) => ({ ...previous, retryUnansweredCall }))} />
                {enabledTopics(prefs).length === 0 && (
                  <p className="notice notice-warn mt-5" role="status">اختر نوعًا واحدًا على الأقل من التنبيهات قبل الحفظ.</p>
                )}
                {validationMessage && <p role="alert" className="mt-4 font-semibold text-danger">{validationMessage}</p>}
                {saveFailed && (
                  <p role="alert" className="notice notice-danger mt-5">
                    ما قدرنا نحفظ. اختياراتك باقية، جرّب مرة ثانية.
                  </p>
                )}
              </div>
            )}
          </section>

          <div className="sticky bottom-0 z-10 mt-5 border-t border-line bg-ground/95 py-3 backdrop-blur-sm">
            <div className="flex gap-3">
              {stepIndex === 0 && editTopic === null ? (
                <Link href={`/tammeni?student=${student.id}`} className="btn-secondary flex-1">
                  رجوع
                </Link>
              ) : (
                <button type="button" className="btn-secondary flex-1" onClick={goPrevious} disabled={saving}>
                  السابق
                </button>
              )}
              {current.kind === "review" ? (
                <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || (savedExists && !dirty)} aria-busy={saving || undefined}>
                  {saving ? <><span className="spinner" aria-hidden="true" /> جارٍ الحفظ…</> : saveFailed ? "إعادة المحاولة" : savedExists && !dirty ? "لا توجد تغييرات للحفظ" : "حفظ التفضيلات"}
                </button>
              ) : (
                <button type="button" className="btn-primary flex-1" onClick={goNext} disabled={saving}>
                  التالي
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LargeChoice({
  name,
  value,
  checked,
  onChange,
  title,
  hint,
  leading,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: React.ReactNode;
  hint?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[5.25rem] cursor-pointer items-center gap-4 rounded-2xl border-2 border-line bg-surface px-5 py-4 transition-colors hover:border-control has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info has-[:focus-visible]:outline-offset-2">
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="sr-only" />
      <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-control bg-surface text-transparent has-[:checked]:border-brand" aria-hidden="true">
        {checked && <CheckIcon size={16} strokeWidth={3} className="text-brand" />}
      </span>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[1.2rem] leading-snug font-bold text-ink">{title}</span>
        {hint && <span className="mt-1 block text-[1rem] leading-7 text-ink-soft">{hint}</span>}
      </span>
      {checked && <span className="text-[0.9375rem] font-semibold text-brand-ink">محدد</span>}
    </label>
  );
}

function TopicReviewList({ prefs, onEdit }: { prefs: Preferences; onEdit: (topic: Topic) => void }) {
  return (
    <div className="divide-y divide-line border-b border-line">
      {topics.map((topic) => {
        const summary = topicSummary(prefs, topic);
        const Icon = topicIcons[topic];
        return (
          <article key={topic} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-[1.125rem] font-bold">
                <Icon size={20} className="text-brand" />
                {guidedLabels[topic]}
                <span className="chip" data-tone={summary.status === "on" ? "ok" : summary.status === "off" ? "neutral" : "warn"}>
                  {summary.status === "on" ? "مفعّل" : summary.status === "off" ? "متوقف" : "يحتاج اختيارًا"}
                </span>
              </h3>
              <p className="mt-1 text-[1rem] leading-7 font-semibold text-ink">
                {summary.status === "on"
                  ? `${prefs[topic].method === "message" ? "رسالة" : "اتصال"} · ${summary.when}`
                  : summary.status === "off"
                    ? "ما يوصلك شيء عنه."
                    : "اختر وقتًا لهذا التنبيه."}
              </p>
              {summary.note && <p className="mt-1 text-[0.9375rem] leading-6 text-ink-soft">{summary.note}</p>}
            </div>
            <button type="button" className="btn-secondary btn-sm min-w-24" aria-label={`تعديل ${guidedLabels[topic]}`} onClick={() => onEdit(topic)}>
              تعديل
            </button>
          </article>
        );
      })}
    </div>
  );
}

function CallRetryOption({ prefs, onChange }: { prefs: Preferences; onChange: (value: boolean) => void }) {
  if (!usesCalls(prefs)) return null;
  return (
    <details className="mt-5 rounded-xl border border-line bg-ground px-4 py-3">
      <summary className="cursor-pointer py-1 text-[1rem] font-semibold text-brand-ink">خيارات إضافية للمكالمات</summary>
      <div className="mt-3">
        <Choice
          type="checkbox"
          name="retry"
          value="retry"
          checked={prefs.retryUnansweredCall}
          onChange={() => onChange(!prefs.retryUnansweredCall)}
          title="إذا ما رديت، نعيد الاتصال بعد 5 دقائق."
          hint="يُحفظ، لكن ما يشتغل في النسخة التجريبية."
        />
      </div>
    </details>
  );
}

function TimingQuestion({
  topic,
  prefs,
  patchTopic,
  patchAttendanceCustom,
  problem,
  previous,
  clearedWas,
}: {
  topic: Topic;
  prefs: Preferences;
  patchTopic: (topic: Topic, change: Record<string, unknown>) => void;
  patchAttendanceCustom: (change: Partial<Preferences["attendance"]["custom"]>) => void;
  problem?: ReturnType<typeof problemsFor>[number];
  previous?: LegacyInfo["needsReview"][number];
  clearedWas?: string;
}) {
  const timing = prefs[topic].timing;
  const setTiming = (value: string) => patchTopic(topic, { timing: value });
  const showProblem = problem?.kind === "choose";
  const summary = topicSummary(prefs, topic);
  // Choosing an option can open its controls below the fold, behind the sticky buttons: bring them up.
  const details = useRef<HTMLDivElement>(null);
  const shownTiming = useRef(timing);
  useEffect(() => {
    if (shownTiming.current === timing) return;
    shownTiming.current = timing;
    // Instant: the page's smooth scrolling can be dropped while these controls are still appearing.
    details.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [timing]);
  return (
    <div className="space-y-5">
      {(previous || clearedWas) && timing === null && (
        <p className="notice notice-warn">
          <InfoIcon size={18} />
          <span>
            {previous?.previousRequest ? (
              <>كان طلبك السابق «{previous.was}». اختر وقتًا من الخيارات المتاحة.</>
            ) : (
              <>كان اختيارك «{previous?.was ?? clearedWas}» غير متاح. اختر بديلًا للمتابعة.</>
            )}
          </span>
        </p>
      )}
      <fieldset className="space-y-3" aria-describedby={showProblem ? `${topic}-timing-error` : undefined}>
        <legend className="mb-3 text-lg font-semibold">اختر الموعد المناسب</legend>
        {timingOptions[topic].map((option) => (
          <LargeChoice
            key={option.value}
            name={`${topic}-timing`}
            value={option.value}
            checked={timing === option.value}
            onChange={() => setTiming(option.value)}
            title={option.label}
            hint={option.hint}
          />
        ))}
        {showProblem && <p id={`${topic}-timing-error`} className="font-semibold text-danger">اختر موعدًا للمتابعة.</p>}
      </fieldset>

      <div ref={details} className="scroll-mt-24 scroll-mb-28 space-y-5">
        {topic === "attendance" && timing === "custom" && (
          <div className="space-y-5 rounded-xl border border-line bg-ground p-4 sm:p-5">
            <fieldset className="space-y-3">
              <legend className="mb-3 font-semibold">كم مرة ترغب بالملخص؟</legend>
              {attendanceCustomOptions.map((option) => (
                <LargeChoice
                  key={option.value}
                  name="attendance-custom-kind"
                  value={option.value}
                  checked={prefs.attendance.custom.kind === option.value}
                  onChange={() => patchAttendanceCustom({ kind: option.value })}
                  title={option.label}
                  hint={option.hint}
                />
              ))}
            </fieldset>
            {prefs.attendance.custom.kind === "weekly" && <DayPicker value={prefs.attendance.custom.day} onChange={(day) => patchAttendanceCustom({ day })} />}
            <TimePicker
              topic="attendance"
              value={getTime(prefs, "attendance")}
              onChange={(time) => patchAttendanceCustom({ time })}
              showError={problem?.kind === "time"}
            />
          </div>
        )}

        {topic === "exams" && timing !== null && timing !== "off" && (
          <div className="space-y-5 rounded-xl border border-line bg-ground p-4 sm:p-5">
            {timing === "custom" && (
              <SelectRow
                id="exams-days"
                label="قبل الاختبار بكم يوم؟"
                value={prefs.exams.customDays}
                options={EXAM_DAYS.map((day) => ({ value: day, label: examDaysOptionLabel(day) }))}
                onChange={(customDays) => patchTopic("exams", { customDays })}
                hint="من يوم إلى 30 يومًا."
              />
            )}
            <TimePicker
              topic="exams"
              value={getTime(prefs, "exams")}
              onChange={(time) => patchTopic("exams", { time })}
              showError={problem?.kind === "time"}
            />
          </div>
        )}

        {topic === "grades" && timing === "monthly" && (
          <div className="space-y-5 rounded-xl border border-line bg-ground p-4 sm:p-5">
            <SelectRow
              id="grades-day-of-month"
              label="في أي يوم من الشهر؟"
              value={prefs.grades.dayOfMonth}
              options={DAYS_OF_MONTH.map((day) => ({ value: day, label: `يوم ${day}` }))}
              onChange={(dayOfMonth) => patchTopic("grades", { dayOfMonth })}
              hint="يشمل الدرجات المنشورة في الشهر السابق."
            />
            <TimePicker
              topic="grades"
              value={getTime(prefs, "grades")}
              onChange={(time) => patchTopic("grades", { time })}
              showError={problem?.kind === "time"}
            />
          </div>
        )}

        {summary.status === "on" && timing !== "immediate" && (
          <div role="status" className="rounded-xl bg-panel px-4 py-3 text-[1.0625rem] leading-8">
            <p><span className="text-ink-soft">الموعد المختار: </span><strong className="font-bold">{summary.when}</strong></p>
            {timing === "end-of-day" && <p className="text-[1rem] leading-7 text-ink-soft">هذا وقت مقترح. لتغييره اختر «اختيار وقت آخر».</p>}
          </div>
        )}
      </div>
    </div>
  );
}

const bigOption =
  "flex min-h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-line bg-surface px-3 text-center text-[1.0625rem] font-bold transition-colors hover:border-control has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-info has-[:focus-visible]:outline-offset-2";

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
  const describedBy = showError ? `${topic}-time-error` : undefined;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 flex items-center gap-2 text-[1.0625rem] font-semibold">
        <ClockIcon size={18} className="text-faint" />
        الساعة <span className="text-brand-ink">بتوقيت السعودية</span>
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {presetTimeOptions.map((o) => (
          <label key={o.value} className={bigOption}>
            <input
              type="radio"
              name={`${topic}-time`}
              value={o.value}
              checked={!other && value === o.value}
              onChange={() => {
                setOther(false);
                onChange(o.value);
              }}
              aria-describedby={describedBy}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
        <label className={bigOption}>
          <input
            type="radio"
            name={`${topic}-time`}
            value="other"
            checked={other}
            onChange={() => {
              setOther(true);
              // Keep the time the parent already has; only repair a value we could not read.
              if (value !== joinTime(hour, minute, period)) onChange(joinTime(hour, minute, period));
            }}
            className="sr-only"
          />
          وقت آخر
        </label>
      </div>

      {other && (
        <div className="arrive mt-3 grid max-w-lg grid-cols-3 gap-2">
          <TimeSelect id={`${topic}-hour`} label="الساعة" value={hour} describedBy={describedBy} invalid={showError} onChange={(h) => onChange(joinTime(h, minute, period))}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </TimeSelect>
          <TimeSelect id={`${topic}-minute`} label="الدقيقة" value={minute} describedBy={describedBy} invalid={showError} onChange={(m) => onChange(joinTime(hour, m, period))}>
            {Array.from({ length: 60 }, (_, i) => i).map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, "0")}
              </option>
            ))}
          </TimeSelect>
          <div>
            <label htmlFor={`${topic}-period`} className="mb-1 block text-[1rem] font-medium text-ink-soft">
              الفترة
            </label>
            <select
              id={`${topic}-period`}
              value={period}
              onChange={(e) => onChange(joinTime(hour, minute, e.target.value as Period))}
              aria-describedby={describedBy}
              aria-invalid={showError || undefined}
              className="field field-lg"
            >
              <option value="am">صباحًا</option>
              <option value="pm">مساءً</option>
            </select>
          </div>
        </div>
      )}
      {showError && (
        <p id={`${topic}-time-error`} className="mt-2 text-[0.9375rem] font-medium text-danger">
          اختر وقتًا للمتابعة.
        </p>
      )}
    </fieldset>
  );
}

function TimeSelect({
  id,
  label,
  value,
  onChange,
  describedBy,
  invalid,
  children,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  describedBy?: string;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[1rem] font-medium text-ink-soft">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="field field-lg num">
        {children}
      </select>
    </div>
  );
}

function SelectRow({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (n: number) => void;
  hint: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block font-semibold">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-describedby={`${id}-hint`} className="field field-lg max-w-xs">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p id={`${id}-hint`} className="mt-1.5 text-[1rem] leading-7 text-ink-soft">
        {hint}
      </p>
    </div>
  );
}

function DayPicker({ value, onChange }: { value: Day; onChange: (day: Day) => void }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 text-[1.0625rem] font-semibold">يوم الملخص الأسبوعي</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {dayOptions.map((o) => (
          <label key={o.value} className={bigOption}>
            <input type="radio" name="attendance-day" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function LegacyNotice({ legacy }: { legacy: LegacyInfo }) {
  return (
    <section aria-labelledby="legacy-title" className="notice notice-info mb-6">
      <InfoIcon size={20} />
      <div className="space-y-1.5">
        <h2 id="legacy-title" className="font-semibold">
          تغيّرت خيارات طمّني
        </h2>
        <p>صار لكل نوع من التنبيهات وقته الخاص بدل وقت واحد للجميع. نقلنا اللي يطابق اختياراتك السابقة كما هو، واخترنا «اتصال» إذا ما كنت محدد طريقة.</p>
        {legacy.notes.length > 0 && (
          <ul className="list-disc space-y-1 ps-5">
            {legacy.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {legacy.needsReview.length > 0 && (
          <p className="font-semibold">
            يحتاج اختيار بديل قبل الحفظ: {legacy.needsReview.map((r) => topicLabels[r.topic]).join("، ")}.
          </p>
        )}
        <p>اختياراتك السابقة تبقى كما هي حتى تحفظ الجديدة.</p>
      </div>
    </section>
  );
}

/** Choices saved in this browser by the earlier version, for the same child. Brought in only on request. */
function BringLocalOffer({ firstName, onUse }: { firstName: string; onUse: () => void }) {
  return (
    <section aria-labelledby="bring-local-title" className="notice notice-info mb-6">
      <InfoIcon size={20} />
      <div>
        <h2 id="bring-local-title" className="font-semibold">
          لقينا اختيارات سابقة لـ{firstName} على هذا الجهاز
        </h2>
        <p className="mt-1">انحفظت في نسخة سابقة على هذا المتصفح فقط. تقدر تراجعها هنا؛ ما تُحفظ في حسابك إلا بعد الضغط على «حفظ»، وما تنحذف من الجهاز.</p>
        <button type="button" onClick={onUse} className="btn-secondary btn-sm mt-3">
          مراجعة الاختيارات السابقة
        </button>
      </div>
    </section>
  );
}

function SetupLoading() {
  return (
    <div aria-busy="true" className="border-t border-line">
      <p role="status" className="sr-only">
        جارٍ تحميل التفضيلات
      </p>
      {[0, 1].map((i) => (
        <div key={i} className="grid gap-4 border-b border-line py-8 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-3 lg:col-span-5">
            <Placeholder className="h-7 w-40" />
            <Placeholder className="h-5 w-64" />
            <Placeholder className="h-24 w-full" />
          </div>
          <div className="tone space-y-4 p-5 lg:col-span-7">
            <Placeholder className="h-7 w-full" />
            <Placeholder className="h-14 w-full" />
            <Placeholder className="h-11 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
