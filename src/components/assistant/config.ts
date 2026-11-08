/**
 * Prototype assumption: one fixed after-school time for every family and every school.
 * It is NOT an official school dismissal time. Change it here and every screen, summary and
 * document-facing text that reads it follows.
 */
export const AFTER_SCHOOL_TIME = { time: "14:00", label: "2:00 مساءً" } as const;

/** True while real automatic sending is off (TAMMENI_AUTO_DISPATCH_REAL). Change this wording before turning it on. */
export const NO_AUTOMATIC_SENDING = "حفظ الموعد لا يعني إرسالًا تلقائيًا: في النسخة التجريبية يتم الإرسال يدويًا من استوديو العرض. كل الأوقات بتوقيت السعودية.";
