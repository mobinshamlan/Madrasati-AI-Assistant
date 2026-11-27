import { parentServerClient, verifiedUser } from "@/lib/supabase/server";
import { riyadhDay } from "@/lib/tammeni/evaluate";
import { rollExam, shiftDays } from "@/lib/tammeni/rolling-dates";
import { PREFERENCE_COLUMNS, rowToPreferences, type PreferencesRow } from "@/lib/tammeni/preferences-row";

/**
 * Preview for the signed-in parent. The student, the records and the saved preferences are all read
 * from Supabase with the parent's own session (RLS), never taken from the browser. No provider request,
 * scheduling, or database write happens here.
 */
export async function POST(request: Request) {
  let input: { studentId?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "تعذّرت قراءة الطلب." }, { status: 400 });
  }
  if (typeof input?.studentId !== "string") return Response.json({ error: "اختر طالبًا." }, { status: 400 });

  const supabase = await parentServerClient();
  if (!(await verifiedUser(supabase))) return Response.json({ error: "ابدأ الدخول التجريبي أولًا." }, { status: 401 });

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, demo_key, full_name")
    .eq("demo_key", input.studentId)
    .maybeSingle();
  if (studentError) return Response.json({ error: "تعذّر تحميل بيانات الطالب من قاعدة البيانات." }, { status: 502 });
  if (!student) return Response.json({ error: "هذا الطالب غير مرتبط بحسابك." }, { status: 404 });

  const [prefs, term, exams, grades] = await Promise.all([
    supabase.from("assistant_preferences").select(PREFERENCE_COLUMNS).eq("student_id", student.id).maybeSingle<PreferencesRow>(),
    supabase.from("attendance_terms").select("school_days, present, absent, late, excused").eq("student_id", student.id).limit(1).maybeSingle(),
    supabase.from("exams").select("subject, kind, exam_date, period_label, status, origin, source_ref").eq("student_id", student.id).eq("status", "scheduled").order("exam_date"),
    supabase.from("grades").select("subject, assessment, score, out_of, published_on").eq("student_id", student.id).order("published_on", { ascending: false }),
  ]);
  if (prefs.error || term.error || exams.error || grades.error) {
    return Response.json({ error: "تعذّر تحميل البيانات من قاعدة البيانات." }, { status: 502 });
  }
  if (!prefs.data) return Response.json({ error: "لا توجد تفضيلات محفوظة لهذا الطالب بعد." }, { status: 400 });

  const preferences = rowToPreferences(prefs.data);
  delete preferences.savedAt;
  const t = term.data;
  // The same moved calendar as the parent's pages.
  const moved = shiftDays(riyadhDay(new Date()));
  const upcoming = (exams.data ?? []).map((e) => rollExam(e, moved)).sort((a, b) => a.exam_date.localeCompare(b.exam_date));
  const body = {
    student: {
      id: student.demo_key,
      name: student.full_name,
      attendance: t ? { present: t.present, schoolDays: t.school_days, absent: t.absent, late: t.late, excused: t.excused } : {},
      exams: upcoming.map((e) => ({ subject: e.subject, kind: e.kind, day: "", date: e.exam_date, period: e.period_label ?? "" })),
      grades: (grades.data ?? []).map((g) => ({ subject: g.subject, assessment: g.assessment, score: Number(g.score), outOf: Number(g.out_of) })),
    },
    preferences,
  };

  try {
    const base = process.env.TAMMENI_BACKEND_URL || "http://127.0.0.1:8000";
    const response = await fetch(new URL("/api/parent/preview", base), {
      method: "POST",
      // The public backend only answers this server; the secret never reaches the browser.
      headers: { "Content-Type": "application/json", "X-Tammeni-Dispatch-Secret": process.env.TAMMENI_DISPATCH_SECRET ?? "" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 422) {
      return Response.json({ error: "التفضيلات غير مكتملة. راجعها واحفظها من جديد." }, { status: 400 });
    }
    if (!response.ok) throw new Error("Backend unavailable");
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "تعذّر الاتصال بالمساعد. تأكد من تشغيل خادم طمّنـــي ثم حاول مجددًا." }, { status: 503 });
  }
}
