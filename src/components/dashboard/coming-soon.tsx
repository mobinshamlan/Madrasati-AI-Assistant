"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ClockIcon, CloseIcon } from "./icons";

type ComingSoonContent = { title: string; description?: string };

const ComingSoonContext = createContext<(content: ComingSoonContent) => void>(() => {});

export function useComingSoon() {
  return useContext(ComingSoonContext);
}

export function ComingSoonProvider({ children }: { children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [content, setContent] = useState<ComingSoonContent>({ title: "" });

  const open = useCallback((next: ComingSoonContent) => {
    setContent(next);
    dialogRef.current?.showModal();
  }, []);

  const close = () => dialogRef.current?.close();

  return (
    <ComingSoonContext.Provider value={open}>
      {children}
      <dialog
        ref={dialogRef}
        aria-labelledby="coming-soon-title"
        aria-describedby="coming-soon-desc"
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-white p-0 text-ink shadow-xl"
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="flex items-center justify-between gap-3 bg-mint-200 px-5 py-3">
          <h2 id="coming-soon-title" className="text-lg font-bold text-brand-800">
            {content.title}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="إغلاق"
            className="grid size-12 cursor-pointer place-items-center rounded-full bg-white text-brand-700 hover:bg-mint-100"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-tile-navy px-3 py-1 text-base font-bold text-white">
            <ClockIcon size={16} />
            غير متوفر في هذه النسخة
          </p>
          <p id="coming-soon-desc" className="text-lg leading-8 text-ink">
            {content.description ?? "هذا القسم غير جاهز في النموذج التجريبي. يمكنك متابعة الحضور والاختبارات والدرجات من الصفحة الرئيسية، وإعداد طمّني من قائمة طمّني."}
          </p>
          <button type="button" onClick={close} className="btn-primary w-full">
            حسنًا
          </button>
        </div>
      </dialog>
    </ComingSoonContext.Provider>
  );
}
