import { PLAN_LIMITS, secondsToMeteredMinutes } from "@doppio/core";
import { prisma } from "@doppio/db";
import { AudioLines, Clock, Crown } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OpenTasks, type OpenTask } from "@/components/open-tasks";
import { SessionList } from "@/components/session-list";
import { UploadAudio } from "@/components/upload-audio";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, sessionCount, usage, recents, openItems] = await Promise.all([
    prisma.user.upsert({
      where: { id: user.id },
      update: { email: user.email ?? undefined },
      create: { id: user.id, email: user.email ?? null },
    }),
    prisma.session.count({ where: { userId: user.id } }),
    prisma.usageLedger.aggregate({
      _sum: { amount: true },
      where: { userId: user.id, kind: "transcribe_seconds", createdAt: { gte: monthStart() } },
    }),
    prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        language: true,
        durationSec: true,
        createdAt: true,
      },
    }),
    prisma.actionItem.findMany({
      where: { done: false, session: { userId: user.id } },
      orderBy: { id: "desc" },
      take: 8,
      include: { session: { select: { id: true, title: true } } },
    }),
  ]);

  const openTasks: OpenTask[] = openItems.map((i) => ({
    id: i.id,
    text: i.text,
    owner: i.owner,
    dueHint: i.dueHint,
    done: i.done,
    session: i.session,
  }));

  const minutesUsed = secondsToMeteredMinutes(usage._sum.amount ?? 0);
  const minutesCap = PLAN_LIMITS[profile.plan].transcribeMinutesPerMonth;
  const usagePct = Math.min(100, Math.round((minutesUsed / minutesCap) * 100));

  const stats = [
    { icon: AudioLines, label: "Sessions", value: String(sessionCount) },
    {
      icon: Clock,
      label: "Minutes this month",
      value: `${minutesUsed} / ${minutesCap}`,
      meterPct: usagePct,
    },
    { icon: Crown, label: "Plan", value: profile.plan === "PRO" ? "Pro" : "Free" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-500">{user.email}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {s.label}
                </p>
                <p className="mt-0.5 truncate text-lg font-semibold text-slate-900">{s.value}</p>
                {s.meterPct !== undefined && (
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-primary-600 transition-all"
                      style={{ width: `${s.meterPct}%` }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <UploadAudio />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        {/* Recents */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent sessions</h2>
            {sessionCount > 0 && (
              <Link
                href="/sessions"
                className="text-sm font-medium text-primary-700 transition hover:text-primary-800"
              >
                View all →
              </Link>
            )}
          </div>
          <SessionList sessions={recents} emptyHint="Your processed sessions will appear here." />
        </section>

        <OpenTasks initial={openTasks} />
      </div>
    </div>
  );
}
