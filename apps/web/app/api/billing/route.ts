import { effectivePlan, PLAN_LIMITS, secondsToMeteredMinutes } from "@doppio/core";
import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { monthStart } from "@/lib/quota";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

function dayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** MVP-32: plan, expiry, current usage vs limits, invoice history. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const [profile, transcribeAgg, askToday, payments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, planExpiresAt: true },
    }),
    prisma.usageLedger.aggregate({
      _sum: { amount: true },
      where: { userId: user.id, kind: "transcribe_seconds", createdAt: { gte: monthStart() } },
    }),
    prisma.usageLedger.count({
      where: { userId: user.id, kind: "ask_call", createdAt: { gte: dayStart() } },
    }),
    prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const plan = effectivePlan(profile?.plan ?? "FREE", profile?.planExpiresAt);
  const limits = PLAN_LIMITS[plan];

  return NextResponse.json({
    plan,
    planExpiresAt: profile?.planExpiresAt ?? null,
    usage: {
      transcribeMinutesThisMonth: secondsToMeteredMinutes(transcribeAgg._sum.amount ?? 0),
      transcribeMinutesCap: limits.transcribeMinutesPerMonth,
      askCallsToday: askToday,
      askCallsCap: limits.askCallsPerDay,
    },
    payments: payments.map((p) => ({
      id: p.id,
      provider: p.provider,
      amountBdt: p.amountBdt,
      status: p.status,
      plan: p.plan,
      createdAt: p.createdAt,
    })),
  });
}
