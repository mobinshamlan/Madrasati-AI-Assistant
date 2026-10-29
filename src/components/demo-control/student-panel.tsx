"use client";

import { useCallback, useEffect, useState } from "react";
import { topicSummary, topics, type Preferences } from "@/components/assistant/preferences";
import { EventForm } from "./event-form";
import { NotificationCard, type NotificationRow, type AttemptRow } from "./notification-card";
import { api, ConfirmDialog, dangerButton, ErrorNote, secondaryButton } from "./shared";

export type Panel = {
  student: { id: string; key: string; name: string; firstName: string };
  preferences: Preferences | null;
  preferencesVersion: string | null;
  events: { id: string; kind: string; event_date: string; summary: string; created_at: string; notification: NotificationRow | null }[];
  attempts: AttemptRow[];
  examsToCancel: { id: string; label: string; examDate: string }[];
  absencesToExcuse: { eventId: string; label: string }[];
};

export function StudentPanel({ studentId, today, onSignedOut }: { studentId: string; today: string; onSignedOut: () => void }) {
  const [panel, setPanel] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: Panel }>({ state: "loading" });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setPanel({ state: "loading" });
      const r = await api<Panel>(`/api/demo-control/students/${studentId}`);
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) return onSignedOut();
        return setPanel({ state: "error", message: r.error });
      }
      setPanel({ state: "ready", data: r.data });
    },
    [studentId, onSignedOut],
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (panel.state === "loading") return <p role="status" className="text-lg text-ink-soft">جارٍ تحميل بيانات الطالب…</p>;
  if (panel.state === "error")
    return (
      <div className="space-y-3">
        <ErrorNote>{panel.message}</ErrorNote>
        <button type="button" onClick={() => load()} className={secondaryButton}>إعادة المحاولة</button>
      </div>
    );

  const p = panel.data;
  const attemptsFor = (id: string) => p.attempts.filter((a) => a.notification_id === id);
  // Attempts whose events were cleared stay on record: clearing never recalls what was sent.
  const shown = new Set(p.events.flatMap((e) => (e.notification ? [e.notification.id] : [])));
  const earlier = p.attempts.filter((a) => !shown.has(a.notification_id));
  return (
    <section aria-labelledby="panel-title" className="space-y-8">
      <h2 id="panel-title" className="text-2xl font-extrabold text-ink">
        {p.student.name}
      </h2>
      {notice && (
        <p role="status" className="rounded-xl bg-mint-100 p-4 font-bold text-brand-800">
          {notice}
        </p>
      )}

      <PreferencesCard panel={p} />

      <EventForm
        panel={p}
        today={today}
        onSaved={() => {
          setNotice(null);
          void load(true);
        }}
      />

      <section aria-labelledby="log-title" className="space-y-4">
        <h3 id="log-title" className="text-xl font-bold text-ink">
          أحداث {p.student.firstName} وتحديثاتها
        </h3>
        {p.events.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-[#9da4ae] p-5 text-lg text-ink">لا توجد أحداث محاكاة لهذا الطالب بعد. سجّل حدثًا من الأعلى.</p>
        ) : (
          <ul className="space-y-4">
            {p.events.map((e) => (
              <li key={e.id}>
                <NotificationCard
                  studentName={p.student.firstName}
                  event={e}
                  attempts={e.notification ? attemptsFor(e.notification.id) : []}
                  onChanged={() => load(true)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {earlier.length > 0 && (
        <section aria-labelledby="earlier-title" className="space-y-2 rounded-xl border border-line bg-white p-5">
          <h3 id="earlier-title" className="text-xl font-bold text-ink">محاولات سابقة لأحداث ممسوحة</h3>
          <p className="text-base text-ink">مسح الأحداث لا يلغي ما أُرسل. هذه المحاولات باقية للمراجعة.</p>
          <ul className="space-y-1 text-base text-ink">
            {earlier.map((a) => (
              <li key={a.id}>
                {a.method === "call" ? "اتصال" : "رسالة"} — {a.provider === "mock" ? "مزود وهمي" : "Twilio"} — {statusWords[a.status] ?? a.status}
                {a.destination_masked ? ` — ${a.destination_masked}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <DangerZone panel={p} onDone={(msg) => { setNotice(msg); void load(true); }} />
    </section>
  );
}

function PreferencesCard({ panel }: { panel: Panel }) {
  return (
    <section aria-labelledby="prefs-title" className="rounded-xl border border-line bg-white p-5">
      <h3 id="prefs-title" className="text-xl font-bold text-ink">
        تفضيلات {panel.student.firstName} المحفوظة (للقراءة)
      </h3>
      {!panel.preferences ? (
        <p className="mt-2 text-lg text-ink">لم يحفظ ولي الأمر تفضيلات لهذا الطالب بعد، فلن يُرسل أي تحديث عنه.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-lg">
          {topics.map((t) => {
            const s = topicSummary(panel.preferences!, t);
            return (
              <li key={t} className="flex flex-wrap gap-x-2">
                <strong className="text-brand-800">{s.label}:</strong>
                <span className="text-ink">{s.status === "off" ? "متوقف" : `${s.short} — ${s.method}`}</span>
              </li>
            );
          })}
          {panel.preferences.retryUnansweredCall && (
            <li className="text-ink">إعادة الاتصال مرة بعد ٥ دقائق: مختارة (غير مفعّلة تلقائيًا في هذه النسخة).</li>
          )}
        </ul>
      )}
    </section>
  );
}

const statusWords: Record<string, string> = { sending: "قيد الإرسال", accepted: "قُبل لدى المزود", delivered: "تم التسليم", failed: "فشل" };

const DEFAULTS_SUMMARY = [
  "الحضور والغياب: بعد نهاية اليوم (2:00 مساءً) — اتصال",
  "تذكير الاختبار: قبل الاختبار بيوم، 6:00 مساءً — اتصال",
  "ملخص الدرجات: يوم ١ من كل شهر، 6:00 مساءً — اتصال",
  "إعادة الاتصال: لا",
];

function DangerZone({ panel, onDone }: { panel: Panel; onDone: (message: string) => void }) {
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
    <section aria-labelledby="danger-title" className="space-y-4 rounded-xl border-2 border-[#fecdca] bg-[#fffbfa] p-5">
      <h3 id="danger-title" className="text-xl font-bold text-[#b42318]">
        إعادة الضبط — {name}
      </h3>
      <p className="text-base leading-7 text-ink">تؤثر هذه الإجراءات في {name} فقط، ولا تحذف الطالب أو حساب ولي الأمر أو بيانات إخوته أو البيانات المستوردة.</p>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => setOpen("reset")} className={dangerButton}>
          إعادة ضبط تفضيلات {name}
        </button>
        <button type="button" onClick={() => setOpen("clear")} className={dangerButton}>
          مسح أحداث المحاكاة لـ{name}
        </button>
      </div>

      <ConfirmDialog
        open={open === "reset"}
        danger
        busy={busy}
        title={`إعادة ضبط تفضيلات ${name}؟`}
        confirmLabel="نعم، أعد الضبط"
        onClose={() => setOpen(null)}
        onConfirm={() =>
          act(`/api/demo-control/students/${panel.student.id}/reset-preferences`, (d) =>
            d.reset ? `أُعيدت تفضيلات ${name} إلى الوضع الافتراضي.` : `لا توجد تفضيلات محفوظة لـ${name}، فلم يتغير شيء.`,
          )
        }
      >
        <p>تعود تفضيلات {name} في حساب ولي الأمر إلى:</p>
        <ul className="list-disc space-y-1 ps-6">
          {DEFAULTS_SUMMARY.map((l) => <li key={l}>{l}</li>)}
        </ul>
        <p>تفضيلات بقية الأبناء والأحداث لا تتغير.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={open === "clear"}
        danger
        busy={busy}
        title={`مسح أحداث المحاكاة لـ${name}؟`}
        confirmLabel="نعم، امسح الأحداث"
        onClose={() => setOpen(null)}
        onConfirm={() =>
          act(`/api/demo-control/students/${panel.student.id}/clear-simulation`, (d) =>
            d.cleared
              ? `مُسح ${d.cleared} من الأحداث وأُلغي ${d.cancelled} من التحديثات غير المرسلة.${d.alreadySent ? ` ${d.alreadySent} منها أُرسل سابقًا ويبقى في السجل.` : ""}`
              : `لا توجد أحداث محاكاة لـ${name}.`,
          )
        }
      >
        <p>تختفي أحداث هذه اللوحة لـ{name} من لوحة ولي الأمر، وتُلغى تحديثاتها التي لم تُرسل. تبقى البيانات المستوردة كما هي.</p>
        <p>
          <strong>ما أُرسل لا يُستعاد:</strong> رسالة سبق إرسالها تبقى مُرسلة، ومكالمة بدأت لدى المزود قد تحتاج إيقافًا منفصلًا من حساب المزود. تبقى سجلات المحاولات للمراجعة.
        </p>
      </ConfirmDialog>
    </section>
  );
}
