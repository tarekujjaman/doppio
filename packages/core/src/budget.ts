import { PLAN_LIMITS, type PlanName } from "./plans";

export type QuotaDecision =
  | { allowed: true; remainingMinutes: number }
  | { allowed: false; reason: "QUOTA_EXCEEDED" | "BUDGET_EXCEEDED" };

/**
 * Two-layer guard before any real STT spend:
 *  1. per-user plan quota (MVP-15) — minutes this month vs plan cap
 *  2. global budget kill-switch — total minutes ever vs MAX_TRANSCRIBE_MINUTES_TOTAL,
 *     protecting the real-money TwinMind/OpenAI credit regardless of plan.
 */
export function checkTranscribeQuota(input: {
  plan: PlanName;
  userMinutesThisMonth: number;
  requestedMinutes: number;
  globalMinutesTotal: number;
  globalCapMinutes: number;
}): QuotaDecision {
  const { plan, userMinutesThisMonth, requestedMinutes, globalMinutesTotal, globalCapMinutes } =
    input;

  if (globalMinutesTotal + requestedMinutes > globalCapMinutes) {
    return { allowed: false, reason: "BUDGET_EXCEEDED" };
  }

  const cap = PLAN_LIMITS[plan].transcribeMinutesPerMonth;
  if (userMinutesThisMonth + requestedMinutes > cap) {
    return { allowed: false, reason: "QUOTA_EXCEEDED" };
  }

  return { allowed: true, remainingMinutes: cap - userMinutesThisMonth - requestedMinutes };
}

export function checkAskQuota(input: {
  plan: PlanName;
  userAskCallsToday: number;
}): { allowed: boolean } {
  return { allowed: input.userAskCallsToday < PLAN_LIMITS[input.plan].askCallsPerDay };
}

/** Seconds → whole minutes, always rounding up (a 61s upload meters as 2 min). */
export function secondsToMeteredMinutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}
