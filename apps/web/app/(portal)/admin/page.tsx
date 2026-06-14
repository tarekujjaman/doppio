import { secondsToMeteredMinutes } from "@doppio/core";
import { prisma } from "@doppio/db";
import { Activity, AudioLines, Coins, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Admin-only overview of all users and usage. */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) notFound(); // hide existence from non-admins

  const [userCount, sessionCount, transcribeAgg, llmAgg, askCount, users, recents] =
    await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.usageLedger.aggregate({ _sum: { amount: true }, where: { kind: "transcribe_seconds" } }),
      prisma.usageLedger.aggregate({ _sum: { amount: true }, where: { kind: "summary_call" } }),
      prisma.usageLedger.count({ where: { kind: "ask_call" } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          plan: true,
          createdAt: true,
          _count: { select: { sessions: true } },
        },
      }),
      prisma.session.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, status: true, source: true, createdAt: true, user: { select: { email: true } } },
      }),
    ]);

  // Per-user transcription minutes (one grouped query, mapped to the user list).
  const perUser = await prisma.usageLedger.groupBy({
    by: ["userId"],
    where: { kind: "transcribe_seconds" },
    _sum: { amount: true },
  });
  const minutesByUser = new Map(perUser.map((r) => [r.userId, secondsToMeteredMinutes(r._sum.amount ?? 0)]));

  const totalMinutes = secondsToMeteredMinutes(transcribeAgg._sum.amount ?? 0);
  // Rough cost: TwinMind/Whisper STT + gpt-4o-mini summary tokens.
  const sttCost = (totalMinutes / 60) * 0.2; // TwinMind ear-3-pro $0.20/hr (Whisper similar)
  const llmTokens = llmAgg._sum.amount ?? 0;
  const llmCost = (llmTokens / 1_000_000) * 0.4;
  const estCost = sttCost + llmCost;

  const stats = [
    { icon: Users, label: "Users", value: String(userCount) },
    { icon: AudioLines, label: "Sessions", value: String(sessionCount) },
    { icon: Activity, label: "Transcribed minutes", value: totalMinutes.toLocaleString() },
    { icon: Coins, label: "Est. spend", value: `$${estCost.toFixed(2)}` },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Admin</h1>
        <Badge tone="brand">{user.email}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className="mt-0.5 truncate text-lg font-semibold text-slate-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        {askCount.toLocaleString()} Ask calls · {(llmTokens / 1000).toFixed(0)}k summary tokens.
        Estimate only.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Plan</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Min</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2 pr-2">
                      <span className="block max-w-[180px] truncate text-slate-700">
                        {u.email ?? "—"}
                        {isAdminEmail(u.email) && <span className="ml-1 text-accent-600">★</span>}
                      </span>
                    </td>
                    <td className="py-2">{u.plan}</td>
                    <td className="py-2 text-right tabular-nums">{u._count.sessions}</td>
                    <td className="py-2 text-right tabular-nums">{minutesByUser.get(u.id) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sessions (all users)</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {recents.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <Link href={`/sessions/${s.id}`} className="min-w-0 flex-1 truncate text-slate-700 hover:text-primary-700">
                    {s.title}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-400">{s.user.email?.split("@")[0]}</span>
                  <Badge
                    tone={s.status === "READY" ? "success" : s.status === "FAILED" ? "danger" : "warning"}
                  >
                    {s.status === "READY" ? "Ready" : s.status === "FAILED" ? "Failed" : "…"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
