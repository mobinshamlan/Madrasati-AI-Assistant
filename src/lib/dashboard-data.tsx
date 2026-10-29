"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Parent, Student, Today } from "@/components/dashboard/data";

// The one place the website reads school data from. The backend (Test_AI_Agent_Upload/backend/store.py)
// is the single source of truth: the school page writes to it and the Agent reads from it, so what the
// parent sees here is exactly what the Agent says and what the school recorded.

export type DashboardData = { parent: Parent; today: Today; students: Student[] };

const REFRESH_MS = 5000;
const DashboardContext = createContext<DashboardData | null>(null);

/** Null outside the provider (the school pages do not use it). */
export function useOptionalDashboardData() {
  return useContext(DashboardContext);
}

export function useDashboardData() {
  const data = useContext(DashboardContext);
  if (!data) throw new Error("useDashboardData must be used inside DashboardDataProvider");
  return data;
}

type State = { data: DashboardData | null; failed: boolean };

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ data: null, failed: false });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/parent/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState({ data: (await res.json()) as DashboardData, failed: false });
    } catch {
      setState((s) => ({ ...s, failed: true }));
    }
  }, []);

  useEffect(() => {
    // Deferred so no state is set synchronously inside the effect body.
    const first = setTimeout(load, 0);
    const again = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, [load]);

  if (!state.data) {
    return (
      <p role="status" className="flex-1 px-4 py-16 text-center text-lg text-ink-soft">
        {state.failed ? "تعذّر الاتصال بالخادم. تأكد أنه يعمل ثم أعد تحميل الصفحة." : "جارٍ تحميل البيانات…"}
      </p>
    );
  }
  return <DashboardContext.Provider value={state.data}>{children}</DashboardContext.Provider>;
}
