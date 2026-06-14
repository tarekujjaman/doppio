import { prisma } from "@doppio/db";
import { notFound, redirect } from "next/navigation";
import { SessionWorkspace } from "@/components/workspace/session-workspace";
import type { WorkspaceSession } from "@/components/workspace/types";
import { createClient } from "@/lib/supabase/server";

/** Session workspace (MVP-30): player + synced transcript + summary/actions/notes. */
export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
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
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) notFound();

  const dto: WorkspaceSession = {
    id: session.id,
    title: session.title,
    status: session.status,
    language: session.language,
    durationSec: session.durationSec,
    privateMode: session.privateMode,
    hasAudio: Boolean(session.audioKey),
    tags: session.tags,
    createdAt: session.createdAt.toISOString(),
    transcript: session.transcript.map((s) => ({
      id: s.id,
      idx: s.idx,
      startMs: s.startMs,
      endMs: s.endMs,
      text: s.text,
      speaker: s.speaker,
    })),
    summary: session.summary
      ? {
          overview: session.summary.overview,
          detail: session.summary.detail,
          decisions: session.summary.decisions,
          nextSteps: session.summary.nextSteps,
          language: session.summary.language,
        }
      : null,
    actionItems: session.actionItems.map((a) => ({
      id: a.id,
      text: a.text,
      owner: a.owner,
      dueHint: a.dueHint,
      done: a.done,
    })),
    notes: session.notes.map((n) => ({
      id: n.id,
      text: n.text,
      anchorMs: n.anchorMs,
      createdAt: n.createdAt.toISOString(),
    })),
  };

  const { t } = await searchParams;
  const initialSeekMs = t && /^\d+$/.test(t) ? Number(t) : undefined;

  return <SessionWorkspace initial={dto} initialSeekMs={initialSeekMs} />;
}
