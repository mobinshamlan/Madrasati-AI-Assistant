"use client";

import { useCallback, useEffect, useState } from "react";
import { school, today } from "@/components/dashboard/data";
import {
  AttendanceIcon,
  BellIcon,
  CheckIcon,
  ClassIcon,
  ClockIcon,
  ExamIcon,
  GradesIcon,
  PhoneIcon,
  SchoolIcon,
  UserIcon,
} from "@/components/dashboard/icons";
import { PageShell } from "@/components/dashboard/page-shell";
import {
  InfoRing,
  SectionTab,
  StudentPicker,
  Tile,
  errorBox,
  primaryButton,
  statusStyles,
} from "@/components/dashboard/ui";

// School system (separate identity from the parent site). Every action is sent to the backend,
// which reads the parent's saved preferences and decides: call, message or nothing.

type Subject = {
  subject_id: string;
  subject_name: string;
  attendance: { date: string; status: string }[];
  grades: { assessment: string; score: number; max_score: number; date: string }[];
};
type Exam = { subject_name: string; day: string; time: string };
type Student = { student_id: string; web_id: string; student_name: string; grade: number; subjects: Subject[]; exams: Exam[] };
type Result = { action: "call" | "message" | "skipped" | "failed"; reason: string; sid?: string };
type LogEvent = { type: string; student_name: string; subject_name: string; at: string; result: Result };
type Send = (text: string, body: Record<string, unknown>) => void;

const TOKEN_KEY = "madrasati-demo:school-token";
const actionLabel: Record<Result["action"], string> = {
  call: "اتصال بولي الأمر عبر طمّني",
  message: "رسالة لولي الأمر",
  skipped: "لا تنبيه",
  failed: "تعذّر الإرسال",
};
const typeLabel: Record<string, string> = { attendance: "حضور وغياب", grade: "درجة", exam: "اختبار" };
const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
type StatusKey = keyof typeof statusStyles;
const knownStatus = (s: string): StatusKey => (s in statusStyles ? (s as StatusKey) : "present");

const field =
  "min-h-11 rounded-lg border-2 border-[#9da4ae] bg-white px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-tile-navy";
const smallPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 font-bold text-white hover:bg-brand-700 disabled:opacity-60";
const smallSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-4 font-bold text-brand-700 hover:bg-mint-100 disabled:opacity-60";
const smallDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-[#b42318] bg-white px-4 font-bold text-[#b42318] hover:bg-[#fef3f2] disabled:opacity-60";
const card = "rounded-b-xl border border-t-0 border-line bg-white p-5";

async function api<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/school${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(typeof body.detail === "string" ? body.detail : "تعذّر الاتصال بالخادم"), { status: res.status });
  }
  return res.json();
}

export function SchoolApp() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // The demo backend lets the school in directly; the login form only appears if it answers 401.
  const [needsLogin, setNeedsLogin] = useState(false);
  useEffect(() => {
    // Deferred so the first render matches the server HTML (sessionStorage is client-only).
    const id = setTimeout(() => {
      try {
        setToken(window.sessionStorage.getItem(TOKEN_KEY));
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);
  const setAuth = (t: string | null) => {
    setToken(t);
    try {
      if (t) window.sessionStorage.setItem(TOKEN_KEY, t);
      else window.sessionStorage.removeItem(TOKEN_KEY);
    } catch {}
  };

  return (
    <PageShell current="school" variant="school">
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {!ready ? null : token || !needsLogin ? (
          <Dashboard
            token={token}
            onLogout={token ? () => setAuth(null) : undefined}
            onExpired={() => {
              setAuth(null);
              setNeedsLogin(true);
            }}
          />
        ) : (
          <Login onLogin={setAuth} />
        )}
      </main>
    </PageShell>
  );
}

function Banner({ children, title, below }: { children?: React.ReactNode; title: React.ReactNode; below?: React.ReactNode }) {
  return (
    <section aria-labelledby="greeting" className="bg-linear-to-b from-mint-200 to-mint-400 pb-8">
      <div className="mx-auto max-w-[1440px] px-4 pt-6 lg:px-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-white/70 bg-[#e5e7eb] text-[#9da4ae]">
              <SchoolIcon size={30} />
            </span>
            <div>{title}</div>
          </div>
          {children}
        </div>
        {below}
      </div>
    </section>
  );
}

function Login({ onLogin }: { onLogin: (t: string) => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api<{ token: string }>("/login", null, { method: "POST", body: JSON.stringify({ username: u, password: p }) });
      onLogin(r.token);
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <>
      <Banner
        title={
          <>
            <h1 id="greeting" className="text-xl font-extrabold text-ink">
              نظام <span className="text-brand-700">{school.name}</span>
            </h1>
            <p className="mt-1 text-sm text-ink-soft">سجّل الدخول بحساب إدارة المدرسة</p>
          </>
        }
      />
      <div className="mx-auto max-w-xl px-4 py-8">
        <SectionTab id="login-title" title="دخول المدرسة" size="lg" />
        <form onSubmit={submit} aria-labelledby="login-title" className="space-y-5 rounded-b-xl border border-t-0 border-line bg-white p-5 sm:p-6">
          <label className="block text-lg font-bold">
            اسم المستخدم
            <input className={`${field} mt-2 block w-full`} value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
          </label>
          <label className="block text-lg font-bold">
            كلمة المرور
            <input className={`${field} mt-2 block w-full`} type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
          </label>
          {err && (
            <p role="alert" className={errorBox}>
              {err}
            </p>
          )}
          <button className={`${primaryButton} w-full`}>دخول</button>
        </form>
      </div>
    </>
  );
}

function Dashboard({ token, onExpired, onLogout }: { token: string | null; onExpired: () => void; onLogout?: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [notice, setNotice] = useState<{ text: string; result: Result } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        api<{ students: Student[]; today: string }>("/students", token),
        api<{ events: LogEvent[] }>("/events", token),
      ]);
      setStudents(s.students);
      setEvents(e.events);
    } catch (x) {
      if ((x as { status?: number }).status === 401) onExpired();
    }
  }, [token, onExpired]);

  useEffect(() => {
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const send: Send = async (text, body) => {
    setBusy(true);
    try {
      const r = await api<{ result: Result }>("/events", token, { method: "POST", body: JSON.stringify(body) });
      setNotice({ text, result: r.result });
      await refresh();
    } catch (x) {
      setNotice({ text, result: { action: "failed", reason: (x as Error).message } });
    } finally {
      setBusy(false);
    }
  };

  const student = students.find((s) => s.web_id === studentId) ?? students[0];
  const title = (
    <>
      <h1 id="greeting" className="text-xl font-extrabold text-ink">
        مرحبًا بك، <span className="text-brand-700">{school.adminName}</span>
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {school.role} · {school.name} · {today.gregorian} · {today.hijri}
      </p>
    </>
  );

  if (!student) {
    return (
      <>
        <Banner title={title} />
        <p className="mx-auto max-w-[1440px] px-4 py-10 text-lg text-ink-soft" role="status">
          جارٍ تحميل بيانات الطلاب…
        </p>
      </>
    );
  }

  const options = students.map((s) => ({ id: s.web_id, name: s.student_name, grade: `الصف ${s.grade}` }));
  const absent = student.subjects.filter((s) => (s.attendance.at(-1)?.status ?? "present") === "absent").length;
  const grades = student.subjects.flatMap((s) => s.grades);

  return (
    <>
      <Banner
        title={title}
        below={
          <>
            <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-white/60 pt-6 md:grid-cols-3">
              <InfoRing Icon={UserIcon} label="الطالب" value={student.student_name} />
              <InfoRing Icon={ClassIcon} label="الصف" value={`الصف ${student.grade}`} />
              <InfoRing Icon={SchoolIcon} label="المدرسة" value={school.name} />
            </dl>
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="ملخص سريع">
              <Tile href="#attendance" Icon={AttendanceIcon} color="bg-tile-navy" label="غياب اليوم" value={`${absent}`} />
              <Tile href="#exams" Icon={ExamIcon} color="bg-tile-orange" label="اختبارات مجدولة" value={`${student.exams.length}`} />
              <Tile href="#grades" Icon={GradesIcon} color="bg-tile-green" label="درجات منشورة" value={`${grades.length}`} />
              <Tile href="#events" Icon={BellIcon} color="bg-tile-olive" label="أحداث مسجلة" value={`${events.length}`} />
            </ul>
          </>
        }
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <StudentPicker
            legend="اختر الطالب لعرض بياناته"
            legendClassName="mb-2 text-sm font-bold text-brand-800"
            selectedId={student.web_id}
            onSelect={setStudentId}
            options={options}
            tone="tinted"
            size="md"
          />
          {onLogout && (
            <button type="button" onClick={onLogout} className={`${smallSecondary} self-start xl:self-center`}>
              تسجيل الخروج
            </button>
          )}
        </div>
      </Banner>
      <p className="sr-only" aria-live="polite">
        يتم الآن عرض بيانات {student.student_name}
      </p>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:px-6">
        <div className="space-y-6">
          <AttendanceSection key={`a-${student.web_id}`} student={student} busy={busy} send={send} />
          <ExamsSection key={`e-${student.web_id}`} student={student} busy={busy} send={send} />
          <GradesSection key={`g-${student.web_id}`} student={student} busy={busy} send={send} />
        </div>
        <aside className="space-y-6" aria-label="نتيجة الإجراء وسجل الأحداث">
          {notice && <NoticeCard notice={notice} />}
          <EventsSection events={events} />
        </aside>
      </div>
    </>
  );
}

function NoticeCard({ notice }: { notice: { text: string; result: Result } }) {
  const failed = notice.result.action === "failed";
  return (
    <section
      role={failed ? "alert" : "status"}
      aria-labelledby="notice-title"
      className={`overflow-hidden rounded-xl border bg-linear-to-b p-5 ${
        failed ? "border-[#fecdca] from-[#fef3f2] to-white" : "border-brand-400 from-mint-200 to-mint-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-tile-navy text-white">
          {notice.result.action === "call" ? <PhoneIcon size={28} /> : <CheckIcon size={28} />}
        </span>
        <div>
          <h2 id="notice-title" className="text-lg font-extrabold text-brand-800">
            قرار النظام
          </h2>
          <p className="text-sm text-ink-soft">{notice.text}</p>
        </div>
      </div>
      <p className={`mt-3 font-bold ${failed ? "text-[#b42318]" : "text-ink"}`}>{actionLabel[notice.result.action]}</p>
      {notice.result.reason && <p className="mt-1 text-sm text-ink-soft">{notice.result.reason}</p>}
    </section>
  );
}

function AttendanceSection({ student, busy, send }: { student: Student; busy: boolean; send: Send }) {
  return (
    <section id="attendance" aria-labelledby="attendance-title" className="scroll-mt-6">
      <SectionTab id="attendance-title" title="الحضور والغياب" aside="حضور اليوم لكل مادة" />
      <div className={card}>
        <ul className="divide-y divide-mint-200 rounded-lg border border-mint-200">
          {student.subjects.map((sub) => {
            const st = statusStyles[knownStatus(sub.attendance.at(-1)?.status ?? "present")];
            return (
              <li key={sub.subject_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="flex flex-wrap items-center gap-3">
                  <span className="font-bold">{sub.subject_name}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${st.className}`}>{st.label}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className={smallDanger}
                    onClick={() =>
                      send(`${student.student_name} غائب عن ${sub.subject_name}`, {
                        type: "attendance",
                        student_id: student.web_id,
                        subject_id: sub.subject_id,
                        status: "absent",
                      })
                    }
                  >
                    تسجيل غائب
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className={smallSecondary}
                    onClick={() =>
                      send(`${student.student_name} حاضر في ${sub.subject_name}`, {
                        type: "attendance",
                        student_id: student.web_id,
                        subject_id: sub.subject_id,
                        status: "present",
                      })
                    }
                  >
                    حاضر
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function ExamsSection({ student, busy, send }: { student: Student; busy: boolean; send: Send }) {
  const [subject, setSubject] = useState(student.subjects[0]?.subject_id ?? "");
  const [day, setDay] = useState(days[0]);
  const [time, setTime] = useState("٨:٠٠ صباحا");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sub = student.subjects.find((x) => x.subject_id === subject);
    send(`جدولة اختبار ${sub?.subject_name} لـ${student.student_name}`, {
      type: "exam",
      student_id: student.web_id,
      subject_id: subject,
      day,
      time,
    });
  };

  return (
    <section id="exams" aria-labelledby="exams-title" className="scroll-mt-6">
      <SectionTab id="exams-title" title={`الاختبارات (${student.exams.length})`} />
      <div className={card}>
        {student.exams.length === 0 ? (
          <p className="text-ink-soft">لا اختبارات مجدولة.</p>
        ) : (
          <ul className="space-y-4">
            {student.exams.map((e, i) => (
              <li key={`${e.subject_name}-${i}`} className="flex gap-4 border-b border-mint-200 pb-4 last:border-0 last:pb-0">
                <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-mint-100 text-brand-600">
                  <ExamIcon size={28} />
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-brand-700">{e.subject_name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span>{e.day}</span>
                    <span aria-hidden="true" className="hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1">
                      <ClockIcon size={15} />
                      {e.time}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3 border-t border-mint-200 pt-5" aria-label="جدولة اختبار">
          <label className="text-sm font-bold text-brand-800">
            المادة
            <select className={`${field} mt-1 block`} value={subject} onChange={(e) => setSubject(e.target.value)}>
              {student.subjects.map((x) => (
                <option key={x.subject_id} value={x.subject_id}>
                  {x.subject_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-brand-800">
            اليوم
            <select className={`${field} mt-1 block`} value={day} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-brand-800">
            الوقت
            <input className={`${field} mt-1 block w-40`} value={time} onChange={(e) => setTime(e.target.value)} required />
          </label>
          <button disabled={busy} className={smallPrimary}>
            جدولة اختبار
          </button>
        </form>
      </div>
    </section>
  );
}

function GradesSection({ student, busy, send }: { student: Student; busy: boolean; send: Send }) {
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [assessment, setAssessment] = useState("الاختبار الأسبوعي");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("100");

  return (
    <section id="grades" aria-labelledby="grades-title" className="scroll-mt-6">
      <SectionTab id="grades-title" title="الدرجات" aside="آخر درجة منشورة لكل مادة" />
      <div className={card}>
        <table className="w-full text-start text-sm">
          <caption className="sr-only">آخر الدرجات المنشورة لـ {student.student_name}</caption>
          <thead>
            <tr className="bg-mint-200 text-brand-800">
              <th scope="col" className="rounded-s-md px-3 py-2.5 text-start font-bold">المادة</th>
              <th scope="col" className="px-3 py-2.5 text-start font-bold">التقييم</th>
              <th scope="col" className="px-3 py-2.5 text-start font-bold">الدرجة</th>
              <th scope="col" className="rounded-e-md px-3 py-2.5 text-start font-bold">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-200">
            {student.subjects.map((sub) => {
              const g = sub.grades.at(-1);
              const pct = g ? Math.round((g.score / g.max_score) * 100) : 0;
              return (
                <tr key={sub.subject_id} className="align-top">
                  <th scope="row" className="px-3 py-3 text-start font-bold">{sub.subject_name}</th>
                  <td className="px-3 py-3 text-ink-soft">{g ? g.assessment : "—"}</td>
                  <td className="px-3 py-3">
                    {g ? (
                      <>
                        <span className="font-bold whitespace-nowrap" dir="ltr">
                          {g.score} / {g.max_score}
                        </span>
                        <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-mint-200" aria-hidden="true">
                          <span className={`block h-full rounded-full ${pct >= 80 ? "bg-brand-500" : "bg-tile-orange"}`} style={{ width: `${pct}%` }} />
                        </span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      aria-expanded={openFor === sub.subject_id}
                      className={smallSecondary}
                      onClick={() => setOpenFor(openFor === sub.subject_id ? null : sub.subject_id)}
                    >
                      نشر درجة
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {openFor && (
          <form
            className="mt-5 flex flex-wrap items-end gap-3 border-t border-mint-200 pt-5"
            aria-label="نشر درجة"
            onSubmit={(e) => {
              e.preventDefault();
              const sub = student.subjects.find((x) => x.subject_id === openFor);
              send(`درجة ${student.student_name} في ${sub?.subject_name}`, {
                type: "grade",
                student_id: student.web_id,
                subject_id: openFor,
                assessment,
                score: Number(score),
                max_score: Number(max),
              });
              setOpenFor(null);
              setScore("");
            }}
          >
            <label className="text-sm font-bold text-brand-800">
              التقييم
              <input className={`${field} mt-1 block w-48`} value={assessment} onChange={(e) => setAssessment(e.target.value)} required />
            </label>
            <label className="text-sm font-bold text-brand-800">
              الدرجة
              <input className={`${field} mt-1 block w-24`} type="number" min="0" step="any" value={score} onChange={(e) => setScore(e.target.value)} required />
            </label>
            <label className="text-sm font-bold text-brand-800">
              من
              <input className={`${field} mt-1 block w-24`} type="number" min="1" step="any" value={max} onChange={(e) => setMax(e.target.value)} required />
            </label>
            <button className={smallPrimary}>نشر</button>
          </form>
        )}
      </div>
    </section>
  );
}

function EventsSection({ events }: { events: LogEvent[] }) {
  return (
    <section id="events" aria-labelledby="events-title" className="scroll-mt-6">
      <div className="flex border-b-4 border-mint-300">
        <h2 id="events-title" className="rounded-t-xl bg-mint-300 px-5 pt-2.5 pb-2 text-lg font-bold text-brand-800">
          سجل الأحداث
        </h2>
      </div>
      <div className="rounded-b-xl border border-t-0 border-line bg-white">
        {events.length === 0 ? (
          <p className="px-5 py-4 text-ink-soft">لا أحداث بعد.</p>
        ) : (
          <ul className="divide-y divide-mint-200">
            {events.slice(0, 15).map((e, i) => (
              <li key={i} className="px-5 py-4">
                <p className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-mint-200 px-2.5 py-0.5 text-xs font-bold text-brand-800">{typeLabel[e.type] ?? e.type}</span>
                  <span className="text-xs text-ink-soft">{new Date(e.at).toLocaleTimeString("ar-SA")}</span>
                </p>
                <h3 className="mt-2 font-bold text-brand-700">
                  {e.student_name} — {e.subject_name}
                </h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{actionLabel[e.result.action]}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
