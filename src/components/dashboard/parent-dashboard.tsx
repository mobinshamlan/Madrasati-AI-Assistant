"use client";

import { useState } from "react";
import { ComingSoonProvider, useComingSoon } from "./coming-soon";
import { parent, students, today, type AttendanceStatus, type Student } from "./data";
import {
  AccessibilityIcon,
  AttendanceIcon,
  CheckIcon,
  ClassIcon,
  ClockIcon,
  ExamIcon,
  GradesIcon,
  InfoIcon,
  MegaphoneIcon,
  PhoneIcon,
  SchoolIcon,
  SparkleIcon,
  UserIcon,
} from "./icons";
import { SiteHeader } from "./site-header";

export function ParentDashboard() {
  return (
    <ComingSoonProvider>
      <DemoNotice />
      <SiteHeader />
      <DashboardBody />
      <footer className="mt-auto border-t border-mint-300 bg-mint-100 px-4 py-4 text-center text-sm text-ink-soft">
        نموذج تعليمي تجريبي ببيانات خيالية — غير تابع لمنصة مدرستي الرسمية ولا يمثل خدمة صادرة عن وزارة التعليم.
      </footer>
      <AccessibilityButton />
    </ComingSoonProvider>
  );
}

function DemoNotice() {
  return (
    <p
      role="note"
      className="flex items-center justify-center gap-2 bg-[#fffaeb] px-4 py-2 text-center text-sm font-bold text-[#7a2e0e] border-b border-[#fedf89]"
    >
      <InfoIcon size={18} className="shrink-0" />
      نموذج تعليمي تجريبي ببيانات خيالية — غير تابع لمنصة مدرستي الرسمية
    </p>
  );
}

function DashboardBody() {
  const [studentId, setStudentId] = useState(students[0].id);
  const student = students.find((s) => s.id === studentId) ?? students[0];

  return (
    <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
      <WelcomeBanner student={student} onSelect={setStudentId} />
      <p className="sr-only" aria-live="polite">
        يتم الآن عرض بيانات {student.name}
      </p>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:px-6">
        <div className="space-y-6">
          <AttendanceSection student={student} />
          <ExamsSection student={student} />
          <GradesSection student={student} />
        </div>
        <aside className="space-y-6" aria-label="الإعلانات والمساعد الذكي والملف الشخصي">
          <AssistantCard />
          <AnnouncementsSection student={student} />
          <ProfileCard />
        </aside>
      </div>
    </main>
  );
}

function WelcomeBanner({ student, onSelect }: { student: Student; onSelect: (id: string) => void }) {
  const rate = attendanceRate(student);
  const average = gradeAverage(student);

  return (
    <section aria-labelledby="greeting" className="bg-linear-to-b from-mint-200 to-mint-400 pb-8">
      <div className="mx-auto max-w-[1440px] px-4 pt-6 lg:px-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full border-4 border-white/70 bg-[#e5e7eb] text-[#9da4ae]">
              <UserIcon size={30} />
            </span>
            <div>
              <h1 id="greeting" className="text-xl font-extrabold text-ink">
                مرحبًا بك، <span className="text-brand-700">{parent.name}</span>
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {parent.role} · {today.gregorian} · {today.hijri}
              </p>
            </div>
          </div>

          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-bold text-brand-800">اختر الابن لعرض بياناته</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {students.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-transparent bg-white/70 px-3 py-2.5 transition-colors hover:bg-white has-[:checked]:border-brand-600 has-[:checked]:bg-white has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-tile-navy"
                >
                  <input
                    type="radio"
                    name="student"
                    value={s.id}
                    checked={s.id === student.id}
                    onChange={() => onSelect(s.id)}
                    className="peer sr-only"
                  />
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-mint-500 text-white">
                    <UserIcon size={22} />
                  </span>
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block font-bold text-brand-800">{s.name}</span>
                    <span className="block text-sm text-ink-soft">{s.grade}</span>
                  </span>
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-mint-500 text-transparent peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white">
                    <CheckIcon size={14} strokeWidth={3} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-white/60 pt-6 md:grid-cols-3">
          <InfoRing Icon={UserIcon} label="الطالب" value={student.name} />
          <InfoRing Icon={ClassIcon} label="الصف" value={`${student.grade} — ${student.classroom}`} />
          <InfoRing Icon={SchoolIcon} label="المدرسة" value={student.school} />
        </dl>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="ملخص سريع">
          <Tile href="#attendance" Icon={AttendanceIcon} color="bg-tile-navy" label="نسبة الحضور" value={`${rate}%`} />
          <Tile href="#exams" Icon={ExamIcon} color="bg-tile-orange" label="اختبارات قادمة" value={`${student.exams.length}`} />
          <Tile href="#grades" Icon={GradesIcon} color="bg-tile-green" label="متوسط آخر الدرجات" value={`${average}%`} />
          <Tile href="#announcements" Icon={MegaphoneIcon} color="bg-tile-olive" label="إعلانات المدرسة" value={`${student.announcements.length}`} />
        </ul>
      </div>
    </section>
  );
}

function InfoRing({ Icon, label, value }: { Icon: typeof UserIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-brand-400 bg-white/50 text-brand-600">
        <Icon size={26} />
      </span>
      <div className="min-w-0">
        <dt className="text-sm text-ink-soft">{label}</dt>
        <dd className="font-bold text-ink">{value}</dd>
      </div>
    </div>
  );
}

function Tile({
  href,
  Icon,
  color,
  label,
  value,
}: {
  href: string;
  Icon: typeof UserIcon;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <li>
      <a
        href={href}
        className="flex h-full flex-col items-start gap-3 rounded-lg bg-brand-600 p-2.5 text-white shadow-sm transition-colors hover:bg-brand-700 sm:flex-row sm:items-center sm:gap-4"
      >
        <span className={`grid size-11 shrink-0 place-items-center rounded-md sm:size-14 ${color}`}>
          <Icon size={28} />
        </span>
        <span>
          <span className="block text-2xl font-extrabold leading-none">{value}</span>
          <span className="mt-1 block font-bold">{label}</span>
        </span>
      </a>
    </li>
  );
}

function SectionTab({ id, title, aside }: { id: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 border-b-4 border-mint-300">
      <h2 id={id} className="rounded-t-xl bg-brand-600 px-5 pt-2.5 pb-2 text-lg font-bold text-white">
        {title}
      </h2>
      {aside && <div className="pb-1.5 text-sm text-ink-soft">{aside}</div>}
    </div>
  );
}

function MoreButton({ title, label, description }: { title: string; label: string; description?: string }) {
  const openComingSoon = useComingSoon();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => openComingSoon({ title, description })}
      className="inline-flex items-center gap-2 rounded-md border border-brand-600 px-4 py-2 text-sm font-bold text-brand-700 hover:bg-mint-100"
    >
      {label}
      <span className="rounded bg-mint-200 px-1.5 py-0.5 text-xs text-brand-800">قريبًا</span>
    </button>
  );
}

const statusStyles: Record<AttendanceStatus, { label: string; className: string }> = {
  present: { label: "حاضر", className: "bg-[#ecfdf3] text-[#067647] ring-[#abefc6]" },
  absent: { label: "غائب", className: "bg-[#fef3f2] text-[#b42318] ring-[#fecdca]" },
  late: { label: "متأخر", className: "bg-[#fffaeb] text-[#93370d] ring-[#fedf89]" },
  excused: { label: "غياب بعذر", className: "bg-[#eff8ff] text-[#175cd3] ring-[#b2ddff]" },
};

function AttendanceSection({ student }: { student: Student }) {
  const a = student.attendance;
  const rate = attendanceRate(student);
  const stats = [
    { label: "أيام الحضور", value: a.present, tone: "text-[#067647]" },
    { label: "أيام الغياب", value: a.absent, tone: "text-[#b42318]" },
    { label: "مرات التأخر", value: a.late, tone: "text-[#93370d]" },
    { label: "غياب بعذر", value: a.excused, tone: "text-[#175cd3]" },
  ];

  return (
    <section id="attendance" aria-labelledby="attendance-title" className="scroll-mt-6">
      <SectionTab id="attendance-title" title="الحضور والغياب" aside={a.termLabel} />
      <div className="rounded-b-xl border border-t-0 border-line bg-white p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <p className="flex items-baseline justify-between">
              <span className="font-bold">نسبة الحضور</span>
              <span className="text-2xl font-extrabold text-brand-700" dir="ltr">{rate}%</span>
            </p>
            <div
              role="meter"
              aria-label="نسبة الحضور"
              aria-valuenow={rate}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-2 h-3 overflow-hidden rounded-full bg-mint-200"
            >
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${rate}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-soft">من أصل {a.schoolDays} يومًا دراسيًا</p>
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-lg bg-mint-50 px-3 py-2.5 ring-1 ring-mint-200">
                  <dt className="text-sm text-ink-soft">{s.label}</dt>
                  <dd className={`text-xl font-extrabold ${s.tone}`}>{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="mb-3 font-bold">هذا الأسبوع</h3>
            <ul className="divide-y divide-mint-200 rounded-lg border border-mint-200">
              {a.week.map((d) => {
                const st = statusStyles[d.status];
                return (
                  <li key={d.date} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="font-bold">{d.day}</span>{" "}
                      <span className="text-sm text-ink-soft">{d.date}/1448 هـ</span>
                      {d.note && <span className="block text-sm text-ink-soft">{d.note}</span>}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${st.className}`}>{st.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <MoreButton title="الحضور والغياب" label="عرض السجل الكامل" />
        </div>
      </div>
    </section>
  );
}

function ExamsSection({ student }: { student: Student }) {
  return (
    <section id="exams" aria-labelledby="exams-title" className="scroll-mt-6">
      <SectionTab id="exams-title" title={`الاختبارات القادمة (${student.exams.length})`} />
      <div className="rounded-b-xl border border-t-0 border-line bg-white p-5">
        <ul className="space-y-4">
          {student.exams.map((e) => (
            <li key={`${e.subject}-${e.hijri}`} className="flex gap-4 border-b border-mint-200 pb-4 last:border-0 last:pb-0">
              <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-mint-100 text-brand-600">
                <ExamIcon size={28} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-brand-700">{e.subject}</span>
                  <span className="rounded bg-tile-navy px-2 py-0.5 text-xs font-bold text-white">{e.kind}</span>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                  <span>
                    التاريخ: {e.day} {e.hijri} هـ ({e.date})
                  </span>
                  <span aria-hidden="true" className="hidden sm:inline">•</span>
                  <span className="inline-flex items-center gap-1">
                    <ClockIcon size={15} />
                    {e.period}
                  </span>
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <MoreButton title="الاختبارات" label="جدول الاختبارات" />
        </div>
      </div>
    </section>
  );
}

function GradesSection({ student }: { student: Student }) {
  return (
    <section id="grades" aria-labelledby="grades-title" className="scroll-mt-6">
      <SectionTab id="grades-title" title="آخر الدرجات" aside={<>المتوسط: <bdi dir="ltr">{gradeAverage(student)}%</bdi></>} />
      <div className="rounded-b-xl border border-t-0 border-line bg-white p-5">
        <table className="w-full text-start text-sm">
          <caption className="sr-only">آخر الدرجات المرصودة لـ {student.name}</caption>
          <thead>
            <tr className="bg-mint-200 text-brand-800">
              <th scope="col" className="rounded-s-md px-3 py-2.5 text-start font-bold">المادة</th>
              <th scope="col" className="px-3 py-2.5 text-start font-bold">التقييم</th>
              <th scope="col" className="hidden px-3 py-2.5 text-start font-bold sm:table-cell">التاريخ</th>
              <th scope="col" className="rounded-e-md px-3 py-2.5 text-start font-bold">الدرجة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mint-200">
            {student.grades.map((g) => {
              const pct = Math.round((g.score / g.outOf) * 100);
              return (
                <tr key={`${g.subject}-${g.assessment}`}>
                  <th scope="row" className="px-3 py-3 text-start font-bold">{g.subject}</th>
                  <td className="px-3 py-3 text-ink-soft">{g.assessment}</td>
                  <td className="hidden px-3 py-3 text-ink-soft sm:table-cell">{g.date} هـ</td>
                  <td className="px-3 py-3">
                    <span className="font-bold whitespace-nowrap" dir="ltr">
                      {g.score} / {g.outOf}
                    </span>
                    <span className="mt-1 block h-1.5 w-16 overflow-hidden rounded-full bg-mint-200" aria-hidden="true">
                      <span
                        className={`block h-full rounded-full ${pct >= 80 ? "bg-brand-500" : "bg-tile-orange"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-5 flex justify-end">
          <MoreButton title="الدرجات" label="كشف الدرجات" />
        </div>
      </div>
    </section>
  );
}

function AssistantCard() {
  const openComingSoon = useComingSoon();
  return (
    <section
      aria-labelledby="assistant-title"
      className="overflow-hidden rounded-xl border border-brand-400 bg-linear-to-b from-mint-200 to-mint-100"
    >
      <div className="flex items-center gap-3 p-5 pb-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-tile-navy text-white">
          <SparkleIcon size={28} />
        </span>
        <div>
          <span className="rounded bg-tile-navy px-2 py-0.5 text-xs font-bold text-white">جديد</span>
          <h2 id="assistant-title" className="mt-1 text-lg font-extrabold text-brand-800">
            المساعد الذكي لولي الأمر
          </h2>
        </div>
      </div>
      <div className="px-5 pb-5">
        <p className="leading-7 text-ink">
          ميزة قادمة تساعدك على متابعة أبنائك دون الحاجة لتصفح المنصة يوميًا. ستتمكن من:
        </p>
        <ul className="mt-3 space-y-2.5">
          <li className="flex gap-2.5">
            <CheckIcon size={20} className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              <strong>اختيار التحديثات</strong> التي تهمك: الحضور والغياب، الاختبارات، الدرجات، وإعلانات المدرسة.
            </span>
          </li>
          <li className="flex gap-2.5">
            <PhoneIcon size={20} className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              <strong>تحديد جدول الاتصال المفضل</strong> لديك (الأيام والوقت) لتلقي ملخص عن أبنائك.
            </span>
          </li>
        </ul>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() =>
            openComingSoon({
              title: "المساعد الذكي لولي الأمر",
              description:
                "نعمل على تجهيز إعدادات المساعد الذكي: اختيار التحديثات وجدول الاتصال المفضل. ستتوفر هذه الخطوة في المرحلة القادمة من النموذج.",
            })
          }
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 font-bold text-white hover:bg-brand-700"
        >
          إعداد المساعد الذكي
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">قريبًا</span>
        </button>
      </div>
    </section>
  );
}

function AnnouncementsSection({ student }: { student: Student }) {
  return (
    <section id="announcements" aria-labelledby="announcements-title" className="scroll-mt-6">
      <div className="flex border-b-4 border-mint-300">
        <h2 id="announcements-title" className="rounded-t-xl bg-mint-300 px-5 pt-2.5 pb-2 text-lg font-bold text-brand-800">
          الإعلانات
        </h2>
      </div>
      <div className="rounded-b-xl border border-t-0 border-line bg-white">
        <p className="border-b border-mint-200 bg-mint-50 px-5 py-2.5 text-sm text-ink-soft">{student.school}</p>
        <ul className="divide-y divide-mint-200">
          {student.announcements.map((n) => (
            <li key={n.title} className="px-5 py-4">
              <p className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-mint-200 px-2.5 py-0.5 text-xs font-bold text-brand-800">{n.tag}</span>
                <span className="text-xs text-ink-soft">{n.date} هـ</span>
              </p>
              <h3 className="mt-2 font-bold text-brand-700">{n.title}</h3>
              <p className="mt-1 text-sm leading-6 text-ink-soft">{n.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProfileCard() {
  const rows = [
    { label: "الاسم", value: parent.name },
    { label: "الصفة", value: `${parent.role} (${parent.relation})` },
    { label: "عدد الأبناء", value: `${students.length}` },
    { label: "البريد الإلكتروني", value: parent.email, ltr: true },
    { label: "الجوال", value: parent.phone, ltr: true },
    { label: "آخر دخول", value: parent.lastLogin },
  ];
  return (
    <section aria-labelledby="profile-title" className="rounded-xl border border-line bg-white">
      <h2 id="profile-title" className="border-b border-mint-200 px-5 py-3 font-bold text-brand-800">
        الملف الشخصي
      </h2>
      <dl className="divide-y divide-mint-100 px-5">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5 text-sm">
            <dt className="text-ink-soft">{r.label}</dt>
            <dd className="font-bold break-all" dir={r.ltr ? "ltr" : undefined}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="px-5 pb-5 pt-2">
        <MoreButton title="تعديل بياناتي" label="تعديل بياناتي" />
      </div>
    </section>
  );
}

function AccessibilityButton() {
  const openComingSoon = useComingSoon();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="أدوات إمكانية الوصول"
      onClick={() => openComingSoon({ title: "إمكانية الوصول", description: "أدوات التخصيص وإمكانية الوصول ستتوفر قريبًا." })}
      className="fixed bottom-4 left-4 z-20 grid size-12 place-items-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700"
    >
      <AccessibilityIcon size={26} />
    </button>
  );
}

function attendanceRate(student: Student) {
  const a = student.attendance;
  return Math.round(((a.present + a.late) / a.schoolDays) * 100);
}

function gradeAverage(student: Student) {
  const g = student.grades;
  return Math.round((g.reduce((sum, x) => sum + x.score / x.outOf, 0) / g.length) * 100);
}
