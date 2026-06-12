import { describe, expect, it } from "vitest";
import { checkAskQuota, checkTranscribeQuota, secondsToMeteredMinutes } from "./budget";
import { effectivePlan } from "./plans";

describe("checkTranscribeQuota", () => {
  const base = {
    plan: "FREE" as const,
    userMinutesThisMonth: 0,
    requestedMinutes: 10,
    globalMinutesTotal: 0,
    globalCapMinutes: 2400,
  };

  it("allows within plan and budget", () => {
    const d = checkTranscribeQuota(base);
    expect(d).toEqual({ allowed: true, remainingMinutes: 110 });
  });

  it("blocks when the user's monthly plan cap would be exceeded", () => {
    const d = checkTranscribeQuota({ ...base, userMinutesThisMonth: 115 });
    expect(d).toEqual({ allowed: false, reason: "QUOTA_EXCEEDED" });
  });

  it("allows exactly up to the cap boundary", () => {
    const d = checkTranscribeQuota({ ...base, userMinutesThisMonth: 110 });
    expect(d).toEqual({ allowed: true, remainingMinutes: 0 });
  });

  it("PRO lifts the monthly cap", () => {
    const d = checkTranscribeQuota({ ...base, plan: "PRO", userMinutesThisMonth: 500 });
    expect(d.allowed).toBe(true);
  });

  it("global budget kill-switch overrides plan headroom", () => {
    const d = checkTranscribeQuota({
      ...base,
      plan: "PRO",
      globalMinutesTotal: 2395,
    });
    expect(d).toEqual({ allowed: false, reason: "BUDGET_EXCEEDED" });
  });
});

describe("checkAskQuota", () => {
  it("blocks at the daily cap", () => {
    expect(checkAskQuota({ plan: "FREE", userAskCallsToday: 19 }).allowed).toBe(true);
    expect(checkAskQuota({ plan: "FREE", userAskCallsToday: 20 }).allowed).toBe(false);
  });
});

describe("secondsToMeteredMinutes", () => {
  it("rounds up", () => {
    expect(secondsToMeteredMinutes(60)).toBe(1);
    expect(secondsToMeteredMinutes(61)).toBe(2);
    expect(secondsToMeteredMinutes(0)).toBe(0);
  });
});

describe("effectivePlan", () => {
  const now = new Date("2026-06-12T00:00:00Z");

  it("keeps FREE as FREE", () => {
    expect(effectivePlan("FREE", null, now)).toBe("FREE");
  });

  it("PRO with future expiry stays PRO", () => {
    expect(effectivePlan("PRO", new Date("2026-07-01"), now)).toBe("PRO");
  });

  it("PRO lapses after expiry", () => {
    expect(effectivePlan("PRO", new Date("2026-06-01"), now)).toBe("FREE");
  });

  it("PRO without expiry is a standing grant", () => {
    expect(effectivePlan("PRO", null, now)).toBe("PRO");
  });
});
