import { effectivePlan, PLAN_LIMITS, PRO_PRICE_BDT, secondsToMeteredMinutes } from "@doppio/core";
import { prisma } from "@doppio/db";
import { Crown, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { CancelButton, UpgradeButton } from "@/components/billing-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthStart } from "@/lib/quota";
import { createClient } from "@/lib/supabase/server";

function dayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function Meter({ label, used, cap }: { label: string; used: number; cap: number }) {
  const pct = Math.min(100, Math.round((used / cap) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">
          {used} / {cap}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-accent-500" : "bg-primary-600"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

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
  const minutesUsed = secondsToMeteredMinutes(transcribeAgg._sum.amount ?? 0);

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Plan card */}
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <Crown className="h-4 w-4 text-accent-500" />
            <CardTitle>Your plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-slate-900" data-testid="plan-name">
                {plan === "PRO" ? "Pro" : "Free"}
              </span>
              {plan === "PRO" ? (
                <Badge tone="success">Active</Badge>
              ) : (
                <Badge tone="neutral">Starter</Badge>
              )}
            </div>

            {plan === "PRO" ? (
              <>
                <p className="text-sm text-slate-500">
                  Renews access until{" "}
                  <strong className="text-slate-700">
                    {profile?.planExpiresAt?.toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </strong>
                  {" · "}৳{PRO_PRICE_BDT}/month
                </p>
                <CancelButton activeUntil={profile?.planExpiresAt?.toISOString() ?? null} />
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-slate-500">
                  Pro unlocks {PLAN_LIMITS.PRO.transcribeMinutesPerMonth.toLocaleString()} minutes of
                  transcription per month and {PLAN_LIMITS.PRO.askCallsPerDay} Ask questions per day —{" "}
                  <strong className="text-slate-700">৳{PRO_PRICE_BDT}/month</strong>.
                </p>
                <UpgradeButton />
              </>
            )}
          </CardContent>
        </Card>

        {/* Usage card */}
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Meter
              label="Transcription minutes (this month)"
              used={minutesUsed}
              cap={limits.transcribeMinutesPerMonth}
            />
            <Meter label="Ask questions (today)" used={askToday} cap={limits.askCallsPerDay} />
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Receipt className="h-4 w-4 text-slate-400" />
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-600">
                    {p.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })} · {p.plan}{" "}
                    via {p.provider}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-medium text-slate-900">৳{p.amountBdt}</span>
                    <Badge
                      tone={
                        p.status === "completed"
                          ? "success"
                          : p.status === "initiated"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {p.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
