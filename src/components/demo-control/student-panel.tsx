"use client";

import { useCallback, useEffect, useState } from "react";
import { topicSummary, topics, type Preferences } from "@/components/assistant/preferences";
import { MethodChip, topicIcons } from "@/components/assistant/summary";
import { arabicMoment } from "@/lib/tammeni/evaluate";
import { EventForm } from "./event-form";
import { NotificationCard, type AttemptRow, type NotificationRow } from "./notification-card";
import { StudentFacts } from "./student-facts";
import { api, attemptLook, ConfirmDialog, ErrorNote, MethodLabel, ModeChip, StatusChip } from "./shared";

export type Panel = {
  student: { id: string; key: string; name: string; firstName: string };
  preferences: Preferences | null;
  preferencesVersion: string | null;
  formOptions?: { subjects: string[]; assessments: string[]; examKinds: string[] };
  events: { id: string; kind: string; event_date: string; summary: string; created_at: string; notification: NotificationRow | null }[];
  attempts: AttemptRow[];
  examsToCancel: { id: string; label: string; examDate: string }[];
  absencesToExcuse: { eventId: string; label: string }[];
};

export function StudentPanel({
  studentId,
  today,
  realDispatch,
  onSignedOut,
}: {
  studentId: string;
  today: string;
  realDispatch: boolean;
  onSignedOut: () => void;
}) {
  const [panel, setPanel] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: Panel }>({
    state: "loading",
  });
  const [notice, setNotice] = useState<string | null>(null);
  // The event just recorded, marked in the history so the eye finds it.
  const [freshId, setFreshId] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false): Promise<Panel | null> => {
      if (!quiet) setPanel({ state: "loading" });
      const r = await api<Panel>(`/api/demo-control/students/${studentId}`);
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) onSignedOut();
        else if (quiet) setNotice(`تعذّر تحديث السجل: ${r.error}`);
        else setPanel({ state: "error", message: r.error });
        return null;
      }
      setPanel({ state: "ready", data: r.data });
      return r.data;
    },
    [studentId, onSignedOut],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (panel.state === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-12" aria-busy="true">
        <p role="status" className="sr-only">
          جارٍ تحميل بيانات الطالب
        </p>
        <div className="sheet h-80 lg:col-span-5" />
        <div className="tone h-80 lg:col-span-7" />
      </div>
    );
  }
  if (panel.state === "error") {
    return (
      <div className="max-w-xl space-y-3">
        <ErrorNote>{panel.message}</ErrorNote>
        <button type="button" onClick={() => load()} className="btn-secondary btn-sm">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const p = panel.data;
  const name = p.student.firstName;
  const attemptsFor = (id: string) => p.attempts.filter((a) => a.notification_id === id);
  const shown = new Set(p.events.flatMap((e) => (e.notification ? [e.notification.id] : [])));
  const earlier = p.attempts.filter((a) => !shown.has(a.notification_id));

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      {/* On phones the wrapper dissolves (display: contents) so the log follows the form directly: the
          operator sees Tammeni's decision without scrolling past the reference panels. */}
      <div className="contents lg:sticky lg:top-4 lg:col-span-5 lg:block lg:space-y-4">
        <div className="order-1 lg:order-none">
        <EventForm
          panel={p}
          today={today}
          onSaved={async () => {
            setNotice(null);
            const data = await load(true);
            if (data?.events[0]) setFreshId(data.events[0].id);
          }}
        />
        </div>
        <div className="order-3 space-y-4 lg:order-none">
          <PreferencesCard panel={p} />
          <StudentFacts studentId={studentId} name={name} />
          <ResetTools panel={p} onDone={(msg) => { setNotice(msg); void load(true); }} />
        </div>
      </div>

      <section aria-labelledby="log-title" className="order-2 min-w-0 lg:order-none lg:col-span-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="log-title" className="text-[1.25rem] font-semibold">
            سجل الإشعارات — {name}
          </h2>
          <p className="num text-[0.9375rem] text-faint">{eventCount(p.events.length)}</p>
        </div>
        {notice && (
          <p role="status" className="notice notice-info arrive mt-3">
            {notice}
          </p>
        )}
        {p.events.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-control bg-surface px-5 py-8 text-center">
            <p className="font-semibold">ما فيه أحداث لـ{name} بعد</p>
            <p className="mt-1 text-[0.9375rem] leading-7 text-ink-soft">سجّل حدثًا من النموذج، وبتظهر بطاقته هنا مع قرار طمّني.</p>
          </div>
        ) : (
          <ul className="studio-event-ledger mt-3">
            {p.events.map((e) => (
              <li key={e.id} id={`event-${e.id}`} className={`scroll-mt-4 ${e.id === freshId ? "studio-fresh" : ""}`}>
                <NotificationCard
                  studentId={studentId}
                  studentName={name}
                  event={e}
                  attempts={e.notification ? attemptsFor(e.notification.id) : []}
                  realDispatch={realDispatch}
                  isFresh={e.id === freshId}
                  onChanged={() => load(true)}
                />
              </li>
            ))}
          </ul>
        )}
        {earlier.length > 0 && <ArchivedAttempts attempts={earlier} />}
      </section>
    </div>
  );
}

function eventCount(n: number) {
  if (n === 0) return "لا أحداث";
  if (n === 1) return "حدث واحد";
  if (n === 2) return "حدثان";
  return n <= 10 ? `${n} أحداث` : `${n} حدثًا`;
}

/** The saved choices every decision is made from. Read only: the parent changes them on their page. */
function PreferencesCard({ panel }: { panel: Panel }) {
  const prefs = panel.preferences;
  const name = panel.student.firstName;
  return (
    <section aria-labelledby="prefs-title" className="tone p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="prefs-title" className="font-semibold">
          تفضيلات ولي الأمر لـ{name}
        </h2>
        <span className="text-[0.8125rem] text-faint">للقراءة فقط</span>
      </div>
      {!prefs ? (
        <p className="mt-3 text-[0.9375rem] leading-7 text-ink-soft">ولي الأمر ما حفظ تفضيلات لـ{name} بعد، فكل حدث بيكون «لن يُرسل».</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {topics.map((t) => {
            const s = topicSummary(prefs, t);
            const Icon = topicIcons[t];
            return (
              <li key={t} className="flex items-start gap-3 py-2.5">
                <Icon size={18} className="mt-1 shrink-0 text-faint" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{s.label}</span>
                    {s.status === "on" ? <MethodChip method={prefs[t].method} /> : <span className="chip">{s.status === "off" ? "متوقف" : "يحتاج اختيارًا"}</span>}
                  </div>
                  {s.status === "on" && <p className="text-[0.875rem] leading-6 text-ink-soft">{s.short}</p>}
                </div>
              </li>
            );
          })}
          {prefs.retryUnansweredCall && (
            <li className="py-2.5 text-[0.875rem] leading-6 text-ink-soft">إعادة الاتصال بعد 5 دقائق: مختارة، لكن ما تُنفَّذ تلقائيًا.</li>
          )}
        </ul>
      )}
    </section>
  );
}

function ArchivedAttempts({ attempts }: { attempts: AttemptRow[] }) {
  return (
    <details className="studio-disclosure mt-4 rounded-2xl bg-surface px-4 sm:px-5">
      <summary className="text-[0.9375rem]">محاولات لأحداث محذوفة ({attempts.length})</summary>
      <p className="text-[0.875rem] leading-6 text-faint">حذف الحدث ما يلغي اللي أُرسل. هذي المحاولات باقية للمراجعة.</p>
      <ul className="mt-2 divide-y divide-rule pb-3">
        {attempts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2.5 text-[0.875rem]">
            <ModeChip provider={a.provider} />
            <StatusChip {...attemptLook(a)} />
            <MethodLabel method={a.method} />
            <span className="text-faint">{arabicMoment(a.created_at)}</span>
            {a.destination_masked && (
              <bdi dir="ltr" className="num text-faint">
                {a.destination_masked}
              </bdi>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

const DEFAULTS_SUMMARY = [
  "الحضور والغياب: بعد نهاية اليوم (2:00 مساءً) — اتصال",
  "تذكير الاختبار: قبل الاختبار بيوم، 6:00 مساءً — اتصال",
  "ملخص الدرجات: يوم 1 من كل شهر، 6:00 مساءً — اتصال",
  "إعادة الاتصال: لا",
];

/** Resetting the demo for one student. Tucked away; each action names what it changes and what it does not. */
function ResetTools({ panel, onDone }: { panel: Panel; onDone: (message: string) => void }) {
  const [open, setOpen] = useState<"reset" | "clear" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = panel.student.firstName;

  const act = async (path: string, done: (data: Record<string, number>) => string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    const r = await api<Record<string, number>>(path, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setOpen(null);
    onDone(done(r.data));
  };

  return (
    <details className="studio-disclosure rounded-2xl bg-surface px-4 sm:px-5">
      <summary className="text-[0.9375rem]">إعادة ضبط العرض لـ{name}</summary>
      <div className="space-y-3 pb-5">
        <p className="text-[0.875rem] leading-6 text-ink-soft">
          يخص {name} فقط. ما يحذف الطالب ولا حساب ولي الأمر ولا بيانات إخوته ولا السجلات المستوردة.
        </p>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => setOpen("reset")} className="btn-danger btn-sm">
            إرجاع التفضيلات الافتراضية
          </button>
          <button type="button" onClick={() => setOpen("clear")} className="btn-danger btn-sm">
            حذف كل أحداث {name}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={open === "reset"}
        danger
        busy={busy}
        title={`إرجاع تفضيلات ${name} للوضع الافتراضي؟`}
        confirmLabel="نعم، أرجعها"
        onClose={() => setOpen(null)}
        onConfirm={() =>
          act(`/api/demo-control/students/${panel.student.id}/reset-preferences`, (d) =>
            d.reset ? `رجعت تفضيلات ${name} للوضع الافتراضي.` : `ما فيه تفضيلات محفوظة لـ${name}، فما تغيّر شيء.`,
          )
        }
      >
        <p>تصير تفضيلات {name} في حساب ولي الأمر:</p>
        <ul className="list-disc space-y-1 ps-6">
          {DEFAULTS_SUMMARY.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p>تفضيلات بقية الأبناء والأحداث ما تتغير.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "clear"}
        danger
        busy={busy}
        title={`حذف أحداث العرض لـ${name}؟`}
        confirmLabel="نعم، احذف الأحداث"
        onClose={() => setOpen(null)}
        onConfirm={() =>
          act(`/api/demo-control/students/${panel.student.id}/clear-simulation`, (d) =>
            d.cleared
              ? `انحذف ${d.cleared} من الأحداث وأُلغي ${d.cancelled} من الإشعارات اللي ما أُرسلت.${d.alreadySent ? ` ${d.alreadySent} منها أُرسل سابقًا ويبقى في السجل.` : ""}`
              : `ما فيه أحداث عرض لـ${name}.`,
          )
        }
      >
        <p>تختفي أحداث العرض لـ{name} من صفحة ولي الأمر، وتُلغى إشعاراتها اللي ما أُرسلت. السجلات المستوردة تبقى كما هي.</p>
        <p>
          <strong>اللي أُرسل ما يُسترجع:</strong> الرسالة المرسلة تبقى مرسلة، والمكالمة اللي بدأت قد تحتاج إيقافًا منفصلًا من حساب مزوّد الاتصالات. سجلات المحاولات تبقى للمراجعة.
        </p>
      </ConfirmDialog>
    </details>
  );
}
