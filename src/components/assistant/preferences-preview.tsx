"use client";

import { useState } from "react";
import type { Preferences } from "./preferences";

type Preview = {
  studentId: string;
  studentName: string;
  updates: { topic: string; label: string; method: "call" | "message"; text: string }[];
};

export function PreferencesPreview({ studentId, preferences }: { studentId: string; preferences: Preferences }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function loadPreview() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch("/api/assistant/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, preferences }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذّر إعداد المعاينة.");
      if (data.studentId !== studentId || !Array.isArray(data.updates)) throw new Error("تعذّرت مطابقة بيانات الطالب.");
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "استغرق إعداد المعاينة وقتًا طويلًا. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="preview-title" className="space-y-4 rounded-xl border border-mint-300 bg-white p-5">
      <h2 id="preview-title" className="text-2xl font-extrabold text-ink">معاينة تحديثات المساعد</h2>
      <p className="text-base leading-7 text-ink-soft">
        اعرض محتوى تجريبيًا حسب اختياراتك المحفوظة. هذه معاينة فقط؛ لن تُرسل رسالة أو تُجرى مكالمة.
        السجلات خيالية، ولا يتم تشغيل المواعيد أو إعادة الاتصال في هذه الخطوة.
      </p>
      <button type="button" disabled={busy} onClick={loadPreview}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-lg bg-brand-600 px-6 font-bold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60">
        {busy ? "جارٍ إعداد المعاينة…" : "معاينة حسب تفضيلاتي"}
      </button>
      {error && <p role="alert" className="text-base text-[#b42318]">{error}</p>}
      <div aria-live="polite" aria-busy={busy}>
        {preview && (
          <div className="space-y-4">
            <p className="font-bold text-ink">معاينة لـ{preview.studentName}</p>
            {preview.updates.map((update) => (
              <article key={update.topic} className="space-y-2 rounded-lg bg-mint-100 p-4">
                <h3 className="font-bold text-brand-800">{update.label} — {update.method === "call" ? "اتصال" : "رسالة"}</h3>
                <p className="whitespace-pre-line text-base leading-8 text-ink">{update.text}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
