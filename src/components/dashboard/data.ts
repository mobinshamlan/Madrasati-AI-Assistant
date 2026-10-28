// All people, schools and records below are fictional, for an educational prototype only.

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type Student = {
  id: string;
  name: string;
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
    id: "reem",
    name: "ريم عبدالرحمن الشهري",
    firstName: "ريم",
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
    id: "faisal",
    name: "فيصل عبدالرحمن الشهري",
    firstName: "فيصل",
    grade: "الصف الثاني المتوسط",
    stage: "المرحلة المتوسطة",
    classroom: "ثاني متوسط / 4",
    school: "متوسطة الأندلس النموذجية للبنين",
    attendance: {
      termLabel: "الفصل الدراسي الأول 1448 هـ",
      schoolDays: 48,
      present: 43,
      absent: 3,
      late: 1,
      excused: 1,
      week: [
        { day: "الأحد", date: "14/05", status: "present" },
        { day: "الاثنين", date: "15/05", status: "absent", note: "غياب بدون عذر" },
        { day: "الثلاثاء", date: "16/05", status: "excused", note: "عذر طبي" },
        { day: "الأربعاء", date: "17/05", status: "present", note: "اليوم" },
      ],
    },
    exams: [
      { subject: "العلوم", kind: "اختبار قصير", day: "الاثنين", date: "2 نوفمبر", hijri: "22/05/1448", period: "الحصة الرابعة" },
      { subject: "الرياضيات", kind: "اختبار منتصف الفصل", day: "الأربعاء", date: "4 نوفمبر", hijri: "24/05/1448", period: "الحصة الثانية" },
      { subject: "اللغة الإنجليزية", kind: "اختبار شفهي", day: "الأحد", date: "8 نوفمبر", hijri: "28/05/1448", period: "الحصة الخامسة" },
      { subject: "الدراسات الاجتماعية", kind: "اختبار قصير", day: "الثلاثاء", date: "10 نوفمبر", hijri: "30/05/1448", period: "الحصة الثالثة" },
    ],
    grades: [
      { subject: "الرياضيات", assessment: "واجب: المعادلات الخطية", score: 8, outOf: 10, date: "11/05/1448" },
      { subject: "العلوم", assessment: "تقرير المختبر", score: 13, outOf: 15, date: "09/05/1448" },
      { subject: "لغتي الخالدة", assessment: "اختبار قصير (1)", score: 6.5, outOf: 10, date: "08/05/1448" },
      { subject: "المهارات الرقمية", assessment: "مشروع: عرض تقديمي", score: 19, outOf: 20, date: "04/05/1448" },
      { subject: "التفكير الناقد", assessment: "مشاركة وتفاعل", score: 9, outOf: 10, date: "03/05/1448" },
    ],
    announcements: [
      {
        title: "جدول الاختبارات القصيرة",
        body: "نُشر جدول الاختبارات القصيرة للأسبوعين القادمين، ويمكن الاطلاع عليه لدى رائد الفصل.",
        date: "16/05/1448",
        tag: "اختبارات",
      },
      {
        title: "رحلة علمية إلى مركز العلوم",
        body: "رحلة لطلاب الصف الثاني المتوسط يوم الخميس 25/05/1448 هـ، ويلزم توقيع نموذج الموافقة.",
        date: "13/05/1448",
        tag: "أنشطة",
      },
      {
        title: "تذكير بقواعد المواظبة",
        body: "يُحتسب التأخر الصباحي بعد الساعة 6:45 صباحًا، ونأمل حرص أولياء الأمور على الحضور المبكر.",
        date: "09/05/1448",
        tag: "تنظيمي",
      },
    ],
  },
];
