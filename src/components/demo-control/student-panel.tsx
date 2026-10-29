"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { topicSummary, topics, type Preferences } from "@/components/assistant/preferences";
import { MessageIcon, PhoneIcon } from "@/components/dashboard/icons";
import { EventForm } from "./event-form";
import { NotificationCard, type AttemptRow, type NotificationRow } from "./notification-card";
import { api, ConfirmDialog, dangerButton, ErrorNote, MethodLabel, secondaryButton, StatusBadge, type StudioView } from "./shared";

export type Panel = {
  student: { id: string; key: string; name: string; firstName: string };
  preferences: Preferences | null;
  preferencesVersion: string | null;
  events: { id: string; kind: string; event_date: string; summary: string; created_at: string; notification: NotificationRow | null }[];
  attempts: AttemptRow[];
  examsToCancel: { id: string; label: string; examDate: string }[];
  absencesToExcuse: { eventId: string; label: string }[];
};

export function StudentPanel({
  studentId,
  today,
  view,
  onSignedOut,
}: {
  studentId: string;
  today: string;
  view: StudioView;
  onSignedOut: () => void;
}) {
  const [panel, setPanel] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: Panel }>({
    state: "loading",
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);

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

  if (panel.state === "loading") {
    return (
      <p role="status" className="text-sm text-[var(--studio-muted)]">
        جارٍ تحميل بيانات الطالب…
      </p>
    );
  }
  if (panel.state === "error") {
    return (
      <div className="space-y-3">
        <ErrorNote>{panel.message}</ErrorNote>
        <button type="button" onClick={() => load()} className={secondaryButton}>
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const p = panel.data;
  const attemptsFor = (id: string) => p.attempts.filter((a) => a.notification_id === id);
  const shown = new Set(p.events.flatMap((e) => (e.notification ? [e.notification.id] : [])));
  const earlier = p.attempts.filter((a) => !shown.has(a.notification_id));
  const latest = p.events[0];

  return (
    <div className="space-y-4">
      {notice && (
        <p role="status" className="studio-alert studio-saved">
          {notice}
        </p>
      )}

      {view === "run" && (
        <>
          <div className="studio-board">
            <EventForm
              panel={p}
              today={today}
              onSaved={() => {
                setNotice(null);
                setFreshId("pending");
                void load(true).then(() => setFreshId("ready"));
              }}
            />
            <PreferencesCard panel={p} />
          </div>
          {latest ? (
            <section aria-labelledby="latest-title" className="studio-panel">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="latest-title">آخر حدث لـ{p.student.firstName}</h2>
                <a href="#log" className="studio-btn-secondary">
                  سجل المحاولات
                </a>
              </div>
              <div className={freshId ? "studio-row-in" : undefined}>
                <NotificationCard
                  studentName={p.student.firstName}
                  event={latest}
                  attempts={latest.notification ? attemptsFor(latest.notification.id) : []}
                  onChanged={() => load(true)}
                />
              </div>
            </section>
          ) : (
            <div className="studio-empty">
              <Image src="/characters/combined.png" alt="" width={72} height={72} />
              <p className="m-0 text-sm leading-6">
                لا أحداث محاكاة لـ{p.student.firstName} بعد. سجّل حدثًا من النموذج أعلاه — الحفظ لا يرسل شيئًا.
              </p>
            </div>
          )}
        </>
      )}

      {view === "log" && (
        <section aria-labelledby="log-title" className="space-y-3">
          <h2 id="log-title" className="text-lg font-extrabold">
            سجل {p.student.firstName}
          </h2>
          {p.events.length === 0 ? (
            <div className="studio-empty">
              <Image src="/characters/combined.png" alt="" width={72} height={72} />
              <p className="m-0 text-sm">لا توجد أحداث بعد. ارجع إلى التشغيل لتسجيل حدث.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {p.events.map((e, i) => (
                <li key={e.id} className="studio-panel studio-row-in" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
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
          {earlier.length > 0 && <ArchivedAttempts attempts={earlier} />}
        </section>
      )}

      {view === "manage" && <DangerZone panel={p} onDone={(msg) => { setNotice(msg); void load(true); }} />}
    </div>
  );
}

function PreferencesCard({ panel }: { panel: Panel }) {
  return (
    <section aria-labelledby="prefs-title" className="studio-panel">
      <h2 id="prefs-title">تفضيلات {panel.student.firstName}</h2>
      <p className="studio-lede">للقراءة فقط — الإرسال التلقائي غير مفعّل.</p>
      {!panel.preferences ? (
        <p className="mt-3 text-sm">لم تُحفظ تفضيلات لهذا الطالب، فلن يُرسل أي تحديث عنه.</p>
      ) : (
        <dl className="mt-2">
          {topics.map((t) => {
            const s = topicSummary(panel.preferences!, t);
            const off = s.status === "off";
            return (
              <div key={t} className="studio-pref">
                <dt>{s.label}</dt>
                <dd className="studio-status" data-tone={off ? "off" : "ready"}>
                  {off ? "متوقف" : "مفعّل"}
                </dd>
                <dd className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.82rem] text-[var(--studio-muted)]">
                  {off ? (
                    "لن يُرسل تحديث عن هذا النوع"
                  ) : (
                    <>
                      {s.method === "اتصال" ? <PhoneIcon size={14} /> : s.method === "رسالة" ? <MessageIcon size={14} /> : null}
                      <span>{s.method}</span>
                      <span>{s.when ?? s.short}</span>
                    </>
                  )}
                </dd>
              </div>
            );
          })}
          {panel.preferences.retryUnansweredCall && (
            <div className="studio-pref">
              <dt>إعادة الاتصال</dt>
              <dd className="studio-status" data-tone="off">
                محفوظة فقط
              </dd>
              <dd className="col-span-2 text-[0.82rem] text-[var(--studio-muted)]">مرة بعد ٥ دقائق — غير منفّذة تلقائيًا.</dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

function ArchivedAttempts({ attempts }: { attempts: AttemptRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="earlier-title" className="studio-panel">
      <h3 id="earlier-title">محاولات لأحداث ممسوحة</h3>
      <p className="studio-lede">مسح الأحداث لا يلغي ما أُرسل. هذه المحاولات باقية للمراجعة.</p>
      <button type="button" className="studio-btn-secondary mt-3" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "إخفاء التفاصيل" : `عرض ${attempts.length} محاولة`}
      </button>
      {open && (
        <ul className="studio-timeline mt-3">
          {attempts.map((a) => (
            <li key={a.id}>
              <p className="m-0 flex flex-wrap items-center gap-2 text-sm">
                <MethodLabel method={a.method} />
                <StatusBadge status={a.status} />
                <span>{a.provider === "mock" ? "مزود وهمي" : "Twilio"}</span>
                {a.destination_masked ? <span dir="ltr">{a.destination_masked}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
    <section aria-labelledby="danger-title" className="studio-panel max-w-xl">
      <h2 id="danger-title">إدارة التجربة — {name}</h2>
      <p className="studio-lede">
        تؤثر هذه الإجراءات في {name} فقط، ولا تحذف الطالب أو حساب ولي الأمر أو بيانات إخوته أو البيانات المستوردة.
      </p>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="studio-manage">
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
          {DEFAULTS_SUMMARY.map((l) => (
            <li key={l}>{l}</li>
          ))}
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
