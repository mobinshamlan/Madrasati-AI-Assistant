// Rules for the automatic scheduler. Pure, so every rule can be pinned in a test.
import { createHash, timingSafeEqual } from "node:crypto";
import type { Decision, Topic } from "./evaluate";

type Env = Record<string, string | undefined>;

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Fails closed when the secret is unset. Hashing first keeps the comparison constant-time for any length. */
export function dispatchSecretValid(env: Env, provided: string | null) {
  const expected = env.TAMMENI_DISPATCH_SECRET;
  return Boolean(expected && provided) && timingSafeEqual(digest(provided as string), digest(expected as string));
}

/** Off unless explicitly switched on. Controls whether due updates are processed at all. */
export const autoDispatchEnabled = (env: Env) => env.TAMMENI_AUTO_DISPATCH === "1";

/** Both switches, on purpose: turning on the scheduler alone can only ever produce mock attempts. */
export const autoRealAllowed = (env: Env) => env.TAMMENI_AUTO_DISPATCH_REAL === "1" && env.TAMMENI_DEMO_REAL_DISPATCH === "1";

const DEFAULT_MAX_LATE_MINUTES = 120;

/** How overdue an update may be and still go out by itself. Older ones wait for an operator. */
export function maxLateMs(env: Env) {
  const minutes = Number(env.TAMMENI_AUTO_DISPATCH_MAX_LATE_MINUTES);
  return (Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : DEFAULT_MAX_LATE_MINUTES) * 60 * 1000;
}

/** After downtime, or for a past-dated event, do not surprise a parent with an old update. */
export function tooLate(decision: Decision, eventCreatedAt: number, now: Date, limitMs: number) {
  const reference = decision.dueAt ? Date.parse(decision.dueAt) : eventCreatedAt;
  return now.getTime() - reference > limitMs;
}

export type DueItem = { id: string; studentId: string; topic: Topic; eventDate: string; decision: Decision; prefsVersion: string | null };

/** Updates that are one message to the parent: a daily or weekly attendance summary, or a month of grades. */
function batchKey(item: DueItem) {
  if (item.decision.window) return `${item.studentId}|grades|${item.decision.window.start}`;
  if (item.topic === "attendance" && item.decision.dueAt) return `${item.studentId}|attendance|${item.decision.dueAt}`;
  return item.id;
}

export function planBatches<T extends DueItem>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(batchKey(item), [...(groups.get(batchKey(item)) ?? []), item]);
  return [...groups.values()].map((group) => {
    const [primary, ...members] = [...group].sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
    return { primary, members };
  });
}
