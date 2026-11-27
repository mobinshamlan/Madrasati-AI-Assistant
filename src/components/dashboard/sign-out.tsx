"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { endDemoSession } from "@/lib/demo-session";
import { LogoutIcon } from "./icons";

/** Ends only the demo session; the saved preferences stay as they are. */
export function SignOut({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const leave = async () => {
    if (leaving) return;
    setLeaving(true);
    await endDemoSession();
    router.replace("/welcome");
  };
  return (
    <button type="button" onClick={leave} aria-busy={leaving || undefined} className={`btn-secondary btn-sm ${className}`}>
      <LogoutIcon size={18} />
      {leaving ? "جارٍ الخروج…" : "خروج"}
    </button>
  );
}
