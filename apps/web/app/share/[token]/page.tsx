import { prisma } from "@doppio/db";
import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  robots: { index: false, follow: false }, // shared content must never be indexed
};

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

/** Public read-only share page (MVP-23): no auth, token-scoped, revocable. */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      session: {
        include: {
          transcript: { orderBy: { idx: "asc" } },
          summary: true,
          actionItems: true,
        },
      },
    },
  });

  if (!link || link.revoked || (link.expiresAt && link.expiresAt < new Date())) notFound();
  const session = link.session;
  const full = link.scope === "full";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-bold tracking-tight text-primary-800">Doppio</span>
          <span className="text-xs text-slate-400">Shared session · read-only</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{session.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {session.createdAt.toLocaleDateString("en-US", { dateStyle: "medium" })}
            {session.durationSec
              ? ` · ${Math.max(1, Math.ceil(session.durationSec / 60))} min`
              : ""}
          </p>
          {session.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {session.tags.map((tag) => (
                <Badge key={tag} tone="brand">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {session.summary && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed text-slate-700">
              <p data-testid="share-summary">{session.summary.overview}</p>
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
            </CardContent>
          </Card>
        )}

        {session.actionItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-slate-400" />
                Action items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {session.actionItems.map((item) => (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                    <span className={item.done ? "text-slate-400 line-through" : undefined}>
                      {item.text}
                      {item.owner && <span className="text-slate-400"> — {item.owner}</span>}
                      {item.dueHint && <span className="text-slate-400"> · {item.dueHint}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {full && session.transcript.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                {session.transcript.map((seg) => (
                  <li key={seg.id} className="flex gap-4" data-testid="share-segment">
                    <span className="mt-0.5 shrink-0 font-mono text-xs tabular-nums text-slate-400">
                      {fmtMs(seg.startMs)}
                    </span>
                    <p className="text-[15px] leading-relaxed text-slate-700">
                      {seg.speaker && (
                        <span className="mr-2 text-xs font-semibold text-accent-700">
                          {seg.speaker}
                        </span>
                      )}
                      {seg.text}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <footer className="pb-8 pt-4 text-center text-xs text-slate-400">
          Captured and summarized with{" "}
          <Link href="/" className="font-medium text-primary-700 hover:underline">
            Doppio
          </Link>{" "}
          — your AI second self.
        </footer>
      </main>
    </div>
  );
}
