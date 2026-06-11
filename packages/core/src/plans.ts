/** Plan limits per Doppio implementation plan §5 (MVP-15/16). */
export const PLAN_LIMITS = {
  FREE: { transcribeMinutesPerMonth: 120, askCallsPerDay: 20 },
  PRO: { transcribeMinutesPerMonth: 3000, askCallsPerDay: 500 }, // "unlimited" with abuse ceiling
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/** Tk 200–300 band; single price point for now (MVP-16). */
export const PRO_PRICE_BDT = 250;

export const PRO_PERIOD_DAYS = 30;
