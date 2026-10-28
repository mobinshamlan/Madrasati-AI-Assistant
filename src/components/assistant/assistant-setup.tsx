"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { students, type Student } from "@/components/dashboard/data";
import { AttendanceIcon, CheckIcon, ClockIcon, ExamIcon, GradesIcon, InfoIcon, PhoneIcon } from "@/components/dashboard/icons";
import { ChoiceCard, SectionTab, StudentPicker } from "@/components/dashboard/ui";
import {
  attendanceFrequencyOptions,
  dayOptions,
  defaultPreferences,
  isBeforeAfterSchool,
  needsAfterSchoolHint,
  savePreferences,
  timeOptions,
  timeText,
  topicStatus,
  useSavedPreferences,
  withTopic,
  type Day,
  type Preferences,
  type Topic,
} from "./preferences";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_COUNT = 5;
const stepTitles: Record<Step, string> = {
  1: "اختر الابن أو الابنة",
  2: "الحضور والغياب",
  3: "الاختبارات",
  4: "الدرجات",
  5: "وقت الاتصال ومراجعة اختياراتك",
};
const topicSteps: Record<Topic, Step> = { attendance: 2, exams: 3, grades: 4 };
const topicIcons: Record<Topic, typeof AttendanceIcon> = { attendance: AttendanceIcon, exams: ExamIcon, grades: GradesIcon };

const toArabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
const stepLabel = (step: Step) => `الخطوة ${toArabicDigits(step)} من ${toArabicDigits(STEP_COUNT)}`;

const card = "rounded-b-xl border border-t-0 border-line bg-white p-5 sm:p-6";
const primaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-brand-600 px-10 text-lg font-bold text-white hover:bg-brand-700";
const secondaryButton =
  "inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-10 text-lg font-bold text-brand-700 hover:bg-mint-100";
const saveErrorText = "تعذّر الحفظ على هذا الجهاز. تأكد أن المتصفح يسمح بحفظ البيانات، ثم حاول مرة أخرى.";
const switchStudentNote = "عند اختيار ابن آخر تظهر اختياراته هو، ولا تُحفظ أي تغييرات لم تضغط بعدها «حفظ التفضيلات».";

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

  const editingThis = editing?.studentId === student.id ? editing : null;
  const showWizard = saved.status !== "saved" || editingThis !== null;
  // Remounting per student (and per saved version) keeps each student's draft separate.
  const wizardKey = `${student.id}:${saved.status === "saved" ? saved.preferences.savedAt : saved.status}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-lg">
      {showWizard ? (
        <Wizard
          key={wizardKey}
          student={student}
          initial={saved.status === "saved" ? saved.preferences : defaultPreferences}
          changes={saved.status === "saved" ? saved.changes : []}
          hadInvalidData={saved.status === "invalid"}
          startStep={editingThis?.step ?? 1}
          focusOnMount={editingThis !== null}
          focusPicker={pickerFocusFor === student.id}
          onSelectStudent={selectStudent}
          onCancel={saved.status === "saved" ? () => setEditing(null) : undefined}
          onSaved={() => {
            setEditing(null);
            setPickerFocusFor(null);
            setJustSavedFor(student.id);
          }}
        />
      ) : (
        <SavedSummary
          key={student.id}
          student={student}
          preferences={saved.preferences}
          changes={saved.changes}
          justSaved={justSavedFor === student.id}
          focusPicker={pickerFocusFor === student.id}
          onSelectStudent={selectStudent}
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
  changes,
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
  changes: string[];
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
  const [returnToReview, setReturnToReview] = useState(startStep !== 1 && startStep !== 5 && focusOnMount);
  const [saveFailed, setSaveFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noTopicsRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(focusOnMount);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusPicker) pickerRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
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

  const enabled = (topic: Topic) => prefs.topics.includes(topic);
  const setEnabled = (topic: Topic, on: boolean) => setPrefs((p) => withTopic(p, topic, on));
  const update = (patch: Partial<Preferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const noTopics = prefs.topics.length === 0;

  const save = () => {
    if (noTopics) {
      noTopicsRef.current?.scrollIntoView({ block: "center" });
      noTopicsRef.current?.focus({ preventScroll: true });
      return;
    }
    if (savePreferences(student.id, prefs)) {
      setSaveFailed(false);
      onSaved();
    } else {
      setSaveFailed(true);
    }
  };

  const notices = (
    <>
      {hadInvalidData && (
        <p className="mb-6 flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] p-4 text-[#7a2e0e]">
          <InfoIcon size={24} className="mt-1 shrink-0" />
          تعذّرت قراءة الاختيارات المحفوظة سابقًا على هذا الجهاز، لذلك عرضنا الاختيارات المقترحة. اضغط «حفظ التفضيلات» في الخطوة الأخيرة لحفظها من جديد.
        </p>
      )}
      {changes.length > 0 && (
        <div className="mb-6">
          <TimingChangesNotice changes={changes} />
        </div>
      )}
    </>
  );

  return (
    <section aria-labelledby="wizard-heading">
      {(step === 1 || step === 5) && notices}

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

      <div className={card}>
        <div aria-hidden="true" className="mb-6 grid grid-cols-5 gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={`h-2 rounded-full ${n <= step ? "bg-brand-500" : "bg-mint-200"}`} />
          ))}
        </div>

        {step === 1 && (
          <div ref={pickerRef} className="space-y-4">
            <StudentPicker
              legend="اختر الابن أو الابنة"
              name="assistant-student"
              selectedId={student.id}
              onSelect={(id) => id !== student.id && onSelectStudent(id)}
            />
            <p className="text-base leading-7 text-ink-soft">{switchStudentNote}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <StepIntro topic="attendance">
              يشمل الملخص الحضور والغياب والتأخر، ويصلك حتى لو كان الحضور كاملًا.
            </StepIntro>
            <fieldset className="min-w-0">
              <legend className="mb-3 font-bold text-ink">كيف تريد أن يصلك ملخص الحضور؟</legend>
              <div className="grid gap-3">
                {attendanceFrequencyOptions.map((o) => (
                  <ChoiceCard
                    key={o.value}
                    type="radio"
                    name="attendance-choice"
                    value={o.value}
                    checked={enabled("attendance") && prefs.attendance.frequency === o.value}
                    onChange={() =>
                      setPrefs((p) => ({ ...withTopic(p, "attendance", true), attendance: { ...p.attendance, frequency: o.value } }))
                    }
                    title={o.label}
                    description={o.hint}
                  />
                ))}
                <OffChoice name="attendance-choice" checked={!enabled("attendance")} onChange={() => setEnabled("attendance", false)} />
              </div>
            </fieldset>
            {enabled("attendance") && prefs.attendance.frequency === "weekly" && (
              <DayPicker
                name="attendance-day"
                legend="اختر يوم ملخص الحضور"
                value={prefs.attendance.day}
                onChange={(day) => update({ attendance: { ...prefs.attendance, day } })}
              />
            )}
            {needsAfterSchoolHint(prefs) && (
              <Hint>يصلك الملخص بعد انتهاء الدوام، لذا اختر في الخطوة الأخيرة وقت اتصال بعد المدرسة.</Hint>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <StepIntro topic="exams">يصلك التذكير لأن موعد الاختبار اقترب، حتى لو لم تتغير تفاصيله.</StepIntro>
            <fieldset className="min-w-0">
              <legend className="mb-3 font-bold text-ink">هل تريد تذكيرًا بالاختبارات؟</legend>
              <div className="grid gap-3">
                <ChoiceCard
                  type="radio"
                  name="exams-choice"
                  value="on"
                  checked={enabled("exams")}
                  onChange={() => setEnabled("exams", true)}
                  title="تذكير قبل الاختبار بيوم واحد"
                  description="لكل اختبار قادم"
                />
                <OffChoice name="exams-choice" checked={!enabled("exams")} onChange={() => setEnabled("exams", false)} />
              </div>
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <StepIntro topic="grades">
              يشمل الملخص الدرجات الجديدة أو المعدّلة فقط. إذا لم تتغير أي درجة، لا يصلك تحديث للدرجات.
            </StepIntro>
            <fieldset className="min-w-0">
              <legend className="mb-3 font-bold text-ink">هل تريد ملخصًا أسبوعيًا للدرجات؟</legend>
              <div className="grid gap-3">
                <ChoiceCard
                  type="radio"
                  name="grades-choice"
                  value="weekly"
                  checked={enabled("grades")}
                  onChange={() => setEnabled("grades", true)}
                  title="ملخص أسبوعي للدرجات الجديدة أو المعدّلة"
                  description="مرة واحدة في الأسبوع، في اليوم الذي تختاره"
                />
                <OffChoice name="grades-choice" checked={!enabled("grades")} onChange={() => setEnabled("grades", false)} />
              </div>
            </fieldset>
            {enabled("grades") && (
              <DayPicker
                name="grades-day"
                legend="اختر يوم ملخص الدرجات"
                value={prefs.grades.day}
                onChange={(day) => update({ grades: { day } })}
              />
            )}
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <fieldset className="min-w-0">
              <legend className="mb-2 flex items-center gap-2 font-bold text-brand-800">
                <ClockIcon size={22} />
                اختر وقت الاتصال — جميع الأوقات بتوقيت السعودية
              </legend>
              <p id="time-hint" className="mb-4 text-ink-soft">
                وقت واحد لكل التحديثات. إذا حان أكثر من تحديث في اليوم نفسه، نجمعها في مكالمة واحدة.
              </p>
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
                    describedBy={needsAfterSchoolHint(prefs) ? "time-hint after-school-hint" : "time-hint"}
                  />
                ))}
              </div>
            </fieldset>
            {needsAfterSchoolHint(prefs) && (
              <Hint id="after-school-hint" warning={isBeforeAfterSchool(prefs)}>
                {isBeforeAfterSchool(prefs)
                  ? "الساعة 1:00 ظهرًا قد تكون قبل انتهاء الدوام. لملخص الحضور اليومي اختر 4:00 عصرًا أو بعدها."
                  : "اخترت ملخص الحضور اليومي، لذا اختر وقتًا بعد انتهاء الدوام المدرسي."}
              </Hint>
            )}

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-ink">ملخص اختياراتك</h3>
              <CallSentence preferences={prefs} student={student} />
              {noTopics && (
                <div
                  ref={noTopicsRef}
                  tabIndex={-1}
                  role="alert"
                  className="rounded-xl border-2 border-[#fecdca] bg-[#fef3f2] p-4 font-bold text-[#b42318]"
                >
                  كل التحديثات متوقفة. فعّل الحضور أو الاختبارات أو الدرجات قبل الحفظ، باستخدام زر «تعديل» بجانب أي منها.
                </div>
              )}
              <ReviewList preferences={prefs} student={student} showStudent onEdit={editFromReview} />
            </div>

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

function StepIntro({ topic, children }: { topic: Topic; children: React.ReactNode }) {
  const Icon = topicIcons[topic];
  return (
    <div className="flex items-start gap-4">
      <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-mint-200 text-brand-700">
        <Icon size={26} />
      </span>
      <p className="leading-8 text-ink">{children}</p>
    </div>
  );
}

function OffChoice({ name, checked, onChange }: { name: string; checked: boolean; onChange: () => void }) {
  return (
    <ChoiceCard
      type="radio"
      name={name}
      value="off"
      checked={checked}
      onChange={onChange}
      title="إيقاف"
      description="لن تصلك تحديثات عن هذا النوع"
    />
  );
}

function Hint({ id, warning, children }: { id?: string; warning?: boolean; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className={`flex gap-3 rounded-xl p-4 ${
        warning ? "border border-[#fedf89] bg-[#fffaeb] font-bold text-[#7a2e0e]" : "bg-mint-100 text-ink ring-1 ring-mint-300"
      }`}
    >
      <InfoIcon size={22} className="mt-1 shrink-0" />
      <span>{children}</span>
    </p>
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

function CallSentence({ preferences, student }: { preferences: Preferences; student: Student }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-mint-100 p-5 ring-1 ring-mint-300 sm:flex-row">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
        <PhoneIcon size={24} />
      </span>
      <p className="text-xl leading-9 font-medium text-ink">
        عند تفعيل الخدمة، تصلك المكالمة الساعة {timeText(preferences)} لتخبرك عن {student.firstName}. إذا حان أكثر
        من تحديث في اليوم نفسه، تصلك مكالمة واحدة تجمعها.
      </p>
    </div>
  );
}

function ReviewList({
  preferences,
  student,
  showStudent,
  showTime,
  onEdit,
}: {
  preferences: Preferences;
  student: Student;
  showStudent?: boolean;
  showTime?: boolean;
  onEdit: (step: Step) => void;
}) {
  const rows = [
    ...(showStudent ? [{ key: "student", step: 1 as Step, label: "الابن أو الابنة", value: student.name, detail: student.grade, on: true }] : []),
    ...(["attendance", "exams", "grades"] as const).map((topic) => {
      const s = topicStatus(preferences, topic);
      return { key: topic, step: topicSteps[topic], label: s.label, value: s.when, detail: s.what, on: s.enabled };
    }),
    ...(showTime
      ? [{ key: "time", step: 5 as Step, label: "وقت الاتصال", value: timeText(preferences), detail: "", on: true }]
      : []),
  ];
  return (
    <ul className="divide-y divide-mint-200 rounded-xl border border-mint-300">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold text-brand-800">{r.label}</p>
            <p className={`text-lg ${r.on ? "font-bold text-ink" : "text-ink-soft"}`}>{r.value}</p>
            {r.detail && <p className="text-base text-ink-soft">{r.detail}</p>}
          </div>
          <button
            type="button"
            onClick={() => onEdit(r.step)}
            aria-label={`تعديل ${r.label}`}
            className="inline-flex min-h-12 shrink-0 items-center justify-center self-start rounded-lg border-2 border-brand-600 bg-white px-6 font-bold text-brand-700 hover:bg-mint-100 sm:self-center"
          >
            تعديل
          </button>
        </li>
      ))}
    </ul>
  );
}

function TimingChangesNotice({ changes, onAcknowledge }: { changes: string[]; onAcknowledge?: () => void }) {
  return (
    <section
      aria-labelledby="timing-changes-title"
      className="rounded-xl border-2 border-[#b2ddff] bg-[#eff8ff] p-5 text-[#194185]"
    >
      <h2 id="timing-changes-title" className="flex items-center gap-2 text-xl font-bold">
        <InfoIcon size={24} className="shrink-0" />
        تغيّر توقيت بعض التحديثات
      </h2>
      <p className="mt-2 leading-8">أصبح لكل نوع من التحديثات موعده الخاص، فنقلنا اختياراتك السابقة كما يلي:</p>
      <ul className="mt-2 list-disc space-y-1 ps-6 leading-8">
        {changes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-2 leading-8">بقيت بقية اختياراتك كما هي، ويمكنك تعديلها في أي وقت.</p>
      {onAcknowledge && (
        <button
          type="button"
          onClick={onAcknowledge}
          className="mt-4 inline-flex min-h-14 items-center justify-center rounded-lg border-2 border-[#194185] bg-white px-8 text-lg font-bold text-[#194185] hover:bg-[#d1e9ff]"
        >
          فهمت
        </button>
      )}
    </section>
  );
}

function SavedSummary({
  student,
  preferences,
  changes,
  justSaved,
  focusPicker,
  onSelectStudent,
  onEdit,
}: {
  student: Student;
  preferences: Preferences;
  changes: string[];
  justSaved: boolean;
  focusPicker: boolean;
  onSelectStudent: (id: string) => void;
  onEdit: (step: Step) => void;
}) {
  const confirmationRef = useRef<HTMLHeadingElement>(null);
  const savedHeaderRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [ackFailed, setAckFailed] = useState(false);
  useEffect(() => {
    // Move focus to the confirmation so keyboard and screen-reader users land on it.
    if (justSaved) confirmationRef.current?.focus();
    else if (focusPicker) pickerRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
  }, [justSaved, focusPicker]);

  const acknowledgeChanges = () => {
    // Saving in the current format clears the notice; keep the original save time.
    if (savePreferences(student.id, preferences, { keepSavedAt: true })) {
      setAckFailed(false);
      savedHeaderRef.current?.focus();
    } else {
      setAckFailed(true);
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
            {changes.length > 0 && (
              <div className="mb-5">
                <TimingChangesNotice changes={changes} onAcknowledge={acknowledgeChanges} />
                {ackFailed && (
                  <p role="alert" className="mt-3 rounded-lg bg-[#fef3f2] px-4 py-3 font-bold text-[#b42318]">
                    {saveErrorText}
                  </p>
                )}
              </div>
            )}
            <div ref={savedHeaderRef} tabIndex={-1} className="focus:outline-none">
              <SectionTab id="saved-title" title={`تفضيلاتك المحفوظة لـ${student.firstName}`} size="lg" />
            </div>
          </>
        )}

        <div
          className={`${justSaved ? "rounded-xl border" : "rounded-b-xl border border-t-0"} space-y-5 border-line bg-white p-5 sm:p-6`}
        >
          <CallSentence preferences={preferences} student={student} />
          <ReviewList preferences={preferences} student={student} showTime onEdit={onEdit} />
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
