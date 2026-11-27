// All people, schools and records below are fictional, for an educational prototype only.
// The signed-in website now reads students and records from Supabase (src/lib/tammeni/parent-data.ts).
// This bundled copy only feeds pages shown before sign-in and the type of a student record.

import type { UnavailableOptions } from "@/components/assistant/preferences";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type Student = {
  id: string;
  name: string;
  /** Assistant timing options this student cannot use. Unset means every option is available. */
  assistantUnavailable?: UnavailableOptions;
  firstName: string;
  grade: string;
  stage: string;
  classroom: string;
  school: string;
  attendance: {
    termLabel: string;
    schoolDays: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    week: { day: string; date: string; status: AttendanceStatus; note?: string }[];
  };
  exams: { subject: string; kind: string; day: string; date: string; hijri: string; period: string }[];
  grades: { subject: string; assessment: string; score: number; outOf: number; date: string }[];
  announcements: { title: string; body: string; date: string; tag: string }[];
};

export const parent = {
  name: "عبدالرحمن بن سعد الشهري",
  shortName: "عبدالرحمن الشهري",
  role: "ولي أمر",
  relation: "الأب",
  email: "abdulrahman.parent@example.com",
  phone: "05•• ••• 4821",
  lastLogin: "الأربعاء 17/05/1448 هـ — 08:12 ص",
};

export const today = { gregorian: "الأربعاء 28 أكتوبر 2026م", hijri: "17 جمادى الأولى 1448 هـ" };

export const students: Student[] = [
  {
    id: "sama",
    name: "سما عبدالرحمن الشهري",
    firstName: "سما",
    grade: "الصف الخامس الابتدائي",
    stage: "المرحلة الابتدائية",
    classroom: "خامس / 2",
    school: "مدرسة رياض النخبة الابتدائية للبنات",
    attendance: {
      termLabel: "الفصل الدراسي الأول 1448 هـ",
      schoolDays: 48,
      present: 46,
      absent: 1,
      late: 1,
      excused: 0,
      week: [
        { day: "الأحد", date: "14/05", status: "present" },
        { day: "الاثنين", date: "15/05", status: "present" },
        { day: "الثلاثاء", date: "16/05", status: "late", note: "تأخر 10 دقائق" },
        { day: "الأربعاء", date: "17/05", status: "present", note: "اليوم" },
      ],
    },
    exams: [
      { subject: "الرياضيات", kind: "اختبار قصير", day: "الأحد", date: "1 نوفمبر", hijri: "21/05/1448", period: "الحصة الثانية" },
      { subject: "لغتي", kind: "اختبار قصير", day: "الثلاثاء", date: "3 نوفمبر", hijri: "23/05/1448", period: "الحصة الأولى" },
      { subject: "العلوم", kind: "اختبار عملي", day: "الاثنين", date: "9 نوفمبر", hijri: "29/05/1448", period: "الحصة الثالثة" },
    ],
    grades: [
      { subject: "الرياضيات", assessment: "اختبار قصير (1)", score: 9.5, outOf: 10, date: "10/05/1448" },
      { subject: "لغتي", assessment: "مهام أدائية", score: 14, outOf: 15, date: "09/05/1448" },
      { subject: "العلوم", assessment: "مشروع: دورة حياة النبات", score: 18, outOf: 20, date: "08/05/1448" },
      { subject: "الدراسات الإسلامية", assessment: "تسميع سورة الملك", score: 10, outOf: 10, date: "04/05/1448" },
      { subject: "اللغة الإنجليزية", assessment: "Quiz – Unit 3", score: 7, outOf: 10, date: "03/05/1448" },
    ],
    announcements: [
      {
        title: "اجتماع أولياء الأمور الأول",
        body: "تدعوكم إدارة المدرسة لحضور لقاء أولياء الأمور يوم الخميس 18/05/1448 هـ الساعة 6:30 مساءً في مسرح المدرسة.",
        date: "15/05/1448",
        tag: "لقاءات",
      },
      {
        title: "أسبوع القراءة المدرسي",
        body: "تبدأ فعاليات أسبوع القراءة يوم الأحد القادم، ويُرجى تزويد الطالبة بقصة قصيرة من اختيارها.",
        date: "12/05/1448",
        tag: "أنشطة",
      },
      {
        title: "تحديث موعد الانصراف",
        body: "يكون انصراف طالبات الصفوف العليا الساعة 12:45 ظهرًا اعتبارًا من الأسبوع القادم.",
        date: "10/05/1448",
        tag: "تنظيمي",
      },
    ],
  },
  {
    id: "ahmad",
    name: "أحمد عبدالرحمن الشهري",
    firstName: "أحمد",
    grade: "الصف الثاني الابتدائي",
    stage: "المرحلة الابتدائية",
    classroom: "ثاني / 3",
    school: "مدرسة ابن خلدون الابتدائية للبنين",
    attendance: {
      termLabel: "الفصل الدراسي الأول 1448 هـ",
      schoolDays: 48,
      present: 47,
      absent: 0,
      late: 1,
      excused: 0,
      week: [
        {
          day: "الأحد",
          date: "14/05",
          status: "present"
        },
        {
          day: "الاثنين",
          date: "15/05",
          status: "present"
        },
        {
          day: "الثلاثاء",
          date: "16/05",
          status: "present"
        },
        {
          day: "الأربعاء",
          date: "17/05",
          status: "late",
          note: "تأخر 5 دقائق"
        }
      ]
    },
    exams: [
      {
        subject: "الرياضيات",
        kind: "اختبار شفهي",
        day: "الثلاثاء",
        date: "3 نوفمبر",
        hijri: "23/05/1448",
        period: "الحصة الأولى"
      },
      {
        subject: "لغتي",
        kind: "اختبار قصير",
        day: "الخميس",
        date: "5 نوفمبر",
        hijri: "25/05/1448",
        period: "الحصة الثانية"
      }
    ],
    grades: [
      {
        subject: "الرياضيات",
        assessment: "اختبار قصير (1)",
        score: 10,
        outOf: 10,
        date: "10/05/1448"
      },
      {
        subject: "لغتي",
        assessment: "قراءة وتهجئة",
        score: 9,
        outOf: 10,
        date: "09/05/1448"
      },
      {
        subject: "العلوم",
        assessment: "نشاط: الحواس الخمس",
        score: 4.5,
        outOf: 5,
        date: "08/05/1448"
      },
      {
        subject: "الدراسات الإسلامية",
        assessment: "تسميع سورة الإخلاص",
        score: 10,
        outOf: 10,
        date: "04/05/1448"
      },
      {
        subject: "اللغة الإنجليزية",
        assessment: "Quiz – Unit 2",
        score: 8,
        outOf: 10,
        date: "03/05/1448"
      }
    ],
    announcements: [
      {
        title: "يوم الأسرة المدرسي",
        body: "تقيم المدرسة يوم الأسرة يوم الأربعاء 24/05/1448 هـ، ونأمل مشاركة أولياء الأمور في الفعاليات الصباحية.",
        date: "14/05/1448",
        tag: "أنشطة"
      },
      {
        title: "تذكير بالزي المدرسي",
        body: "يُرجى الالتزام بالزي المدرسي الكامل وحذاء المدرسة الرياضي في حصص التربية البدنية.",
        date: "11/05/1448",
        tag: "تنظيمي"
      },
      {
        title: "نتائج التقويم المستمر",
        body: "أصبحت نتائج التقويم المستمر للأسبوع الرابع متاحة للاطلاع في صفحة الطالب.",
        date: "09/05/1448",
        tag: "اختبارات"
      }
    ]
  },
];
