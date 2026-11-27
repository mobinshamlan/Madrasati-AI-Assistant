import { AttendanceIcon, ExamIcon, GradesIcon } from "@/components/dashboard/icons";

// The welcome page's example family and its three chosen alerts. The timing words match the alert settings
// (components/assistant/preferences.ts). Step 2 shows these choices and step 3 plays
// the same list as a school day, so what the parent "chose" is exactly what arrives.

export const family = [
  { name: "سما", grade: "الصف الخامس الابتدائي", school: "رياض النخبة للبنات", tone: undefined },
  { name: "أحمد", grade: "الصف الثاني الابتدائي", school: "ابن خلدون للبنين", tone: "b" },
] as const;

export const alerts = [
  {
    id: "absence",
    Icon: AttendanceIcon,
    title: "غياب أحمد",
    child: family[1],
    when: "مباشرة",
    method: "call",
    time: "7:40 صباحًا",
    news: "أحمد غائب عن محاضرته في المنصة.",
    call: "ahmed",
  },
  {
    id: "grades",
    Icon: GradesIcon,
    title: "درجات سما",
    child: family[0],
    when: "مباشرة",
    method: "call",
    time: "1:00 ظهرًا",
    news: "سما حققت الدرجة الكاملة في العلوم!",
    call: "sama",
  },
  {
    id: "exams",
    Icon: ExamIcon,
    title: "اختبارات أحمد",
    child: family[1],
    when: "قبل الاختبار بيوم، 6:00 مساءً",
    method: "message",
    time: "6:00 مساءً",
    news: "تذكير بموعد اختبار العلوم.",
    call: null,
  },
] as const;

export const methodLabel = { call: "اتصال", message: "رسالة" } as const;
