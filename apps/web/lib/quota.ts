import {
  checkTranscribeQuota,
  effectivePlan,
  secondsToMeteredMinutes,
  type QuotaDecision,
} from "@doppio/core";
import { prisma } from "@doppio/db";
import { isAdminEmail } from "@/lib/admin";

export function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Two-layer transcription gate: per-user monthly plan cap + global budget kill-switch. */
export async function getTranscribeDecision(
  userId: string,
  requestedSeconds: number,
): Promise<QuotaDecision> {
  const [user, userAgg, globalAgg] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true, email: true },
    }),
    prisma.usageLedger.aggregate({
      _sum: { amount: true },
      where: { userId, kind: "transcribe_seconds", createdAt: { gte: monthStart() } },
    }),
    prisma.usageLedger.aggregate({
      _sum: { amount: true },
      where: { kind: "transcribe_seconds" },
    }),
  ]);

  // Admins have no limits.
  if (isAdminEmail(user?.email)) return { allowed: true, remainingMinutes: Number.POSITIVE_INFINITY };

  return checkTranscribeQuota({
    plan: effectivePlan(user?.plan ?? "FREE", user?.planExpiresAt),
    userMinutesThisMonth: secondsToMeteredMinutes(userAgg._sum.amount ?? 0),
    requestedMinutes: secondsToMeteredMinutes(requestedSeconds),
    globalMinutesTotal: secondsToMeteredMinutes(globalAgg._sum.amount ?? 0),
    globalCapMinutes: Number(process.env.MAX_TRANSCRIBE_MINUTES_TOTAL ?? 2400),
  });
}
