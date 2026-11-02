import type { Metadata } from "next";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";

export const metadata: Metadata = { title: "أخبار أبنائك | طمّني" };

export default function TammeniHome() {
  return <ParentDashboard />;
}
