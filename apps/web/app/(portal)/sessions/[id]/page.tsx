import { prisma } from "@doppio/db";
import { ArrowLeft, ListChecks } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Read-only session view — M4 turns this into the full workspace (player, notes, Ask). */
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: {
      transcript: { orderBy: { idx: "asc" } },
      summary: true,
      actionItems: true,
    },
  });
  if (!session) notFound();

  const processing = ["UPLOADED", "TRANSCRIBING", "SUMMARIZING"].includes(session.status);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All sessions
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{session.title}</h1>
          <Badge tone={session.status === "READY" ? "success" : processing ? "warning" : "danger"}>
            {session.status === "READY" ? "Ready" : session.status}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {session.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          {session.durationSec ? ` · ${Math.max(1, Math.ceil(session.durationSec / 60))} min` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Transcript */}
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            {session.transcript.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {processing ? "Transcribing — check back in a moment." : "No transcript available."}
              </p>
            ) : (
              <ol className="space-y-4">
                {session.transcript.map((seg) => (
                  <li key={seg.id} className="flex gap-4">
                    <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-slate-400">
                      {fmtMs(seg.startMs)}
                    </span>
                    <p className="text-[15px] leading-relaxed text-slate-700">{seg.text}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Side panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {session.summary ? (
                <div className="space-y-4 text-sm leading-relaxed text-slate-700">
                  <p>{session.summary.overview}</p>
                  {session.summary.decisions && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Decisions
                      </p>
                      <p>{session.summary.decisions}</p>
                    </div>
                  )}
                  {session.summary.nextSteps && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Next steps
                      </p>
                      <p>{session.summary.nextSteps}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">
                  {processing ? "Summary coming up…" : "AI summaries arrive with the next update."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-slate-400" />
                Action items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.actionItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No action items yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {session.actionItems.map((item) => (
                    <li key={item.id} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                      <span>
                        {item.text}
                        {item.owner && <span className="text-slate-400"> — {item.owner}</span>}
                        {item.dueHint && <span className="text-slate-400"> · {item.dueHint}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {session.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {session.tags.map((tag) => (
                <Badge key={tag} tone="brand">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
