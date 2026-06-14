import { buildGlobalAskPrompt, createLLMClient, extractCitations, type AskHistoryTurn } from "@doppio/ai";
import { checkAskQuota, effectivePlan } from "@doppio/core";
import { prisma } from "@doppio/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isAdminEmail } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { retrieveChunksGlobal } from "@/lib/pipeline/index-session";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  threadId: z.string().optional(),
  question: z.string().min(1).max(2_000),
});

function dayStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * GET — chat history + a conversation's messages.
 *   ?threadId=X → load that thread (must be the user's); otherwise the most recent.
 * Always returns `threads` (the user's memory conversations, newest first) so the UI
 * can show a history list and let the user continue any of them.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const requested = new URL(request.url).searchParams.get("threadId");

  const threadRows = await prisma.askThread.findMany({
    where: { userId: user.id, sessionId: null },
    orderBy: { createdAt: "desc" },
    include: {
      messages: { where: { role: "user" }, orderBy: { createdAt: "asc" }, take: 1, select: { text: true } },
    },
  });
  const threads = threadRows.map((t) => ({
    id: t.id,
    title: t.messages[0]?.text?.slice(0, 80) ?? "New chat",
    createdAt: t.createdAt.toISOString(),
  }));

  const currentId =
    (requested && threadRows.some((t) => t.id === requested) ? requested : null) ?? threadRows[0]?.id ?? null;
  const messages = currentId
    ? await prisma.askMessage.findMany({
        where: { threadId: currentId },
        orderBy: { createdAt: "asc" },
        take: 200,
      })
    : [];

  return Response.json({
    threadId: currentId,
    threads,
    messages: messages.map((m) => ({ role: m.role, text: m.text, citations: m.citations ?? [] })),
  });
}

/**
 * Ask Doppio — global, personal RAG chat over the user's WHOLE memory (transcripts +
 * summaries + notes + actions across all their sessions). Strictly user-scoped.
 * SSE events: meta {threadId} → delta {text}* → done {citations:[{sessionId,sessionTitle,startMs,kind}]}.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);
  const { question, threadId } = parsed.data;

  // Daily Ask quota (shared with per-session Ask).
  const [profile, askCallsToday] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiresAt: true } }),
    prisma.usageLedger.count({
      where: { userId: user.id, kind: "ask_call", createdAt: { gte: dayStart() } },
    }),
  ]);
  const plan = effectivePlan(profile?.plan ?? "FREE", profile?.planExpiresAt);
  if (!isAdminEmail(user.email) && !checkAskQuota({ plan, userAskCallsToday: askCallsToday }).allowed) {
    return apiError("QUOTA_EXCEEDED", "Daily Ask limit reached — upgrade for more", 402);
  }

  const llm = createLLMClient();

  // Retrieve top-k chunks across ALL the user's sessions (strictly userId-scoped).
  const [queryEmbedding] = await llm.embed([question]);
  const chunks = await retrieveChunksGlobal(user.id, queryEmbedding!, 8);

  // Continue the given thread (if it's the user's) — otherwise start a NEW chat.
  // No threadId means "new chat", so each fresh conversation is its own history entry.
  const thread =
    (threadId ? await prisma.askThread.findFirst({ where: { id: threadId, userId: user.id } }) : null) ??
    (await prisma.askThread.create({ data: { userId: user.id } }));

  const historyRows = await prisma.askMessage.findMany({
    where: { threadId: thread.id },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const history: AskHistoryTurn[] = historyRows
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

  await prisma.askMessage.create({ data: { threadId: thread.id, role: "user", text: question } });
  await prisma.usageLedger.create({ data: { userId: user.id, kind: "ask_call", amount: 1 } });

  const prompt = buildGlobalAskPrompt({
    excerpts: chunks.map((c, n) => ({
      n,
      text: c.text,
      sessionTitle: c.sessionTitle,
      kind: c.kind,
      startMs: c.startMs,
    })),
    question,
    history,
  });

  // Map the prompt's result-local [seg:N] back to the source session + timestamp.
  const citationByN = new Map(
    chunks.map((c, n) => [
      n,
      { sessionId: c.sessionId, sessionTitle: c.sessionTitle, startMs: c.startMs ?? 0, kind: c.kind },
    ]),
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("meta", { threadId: thread.id });

      let answer = "";
      try {
        for await (const delta of llm.streamComplete(prompt)) {
          answer += delta;
          send("delta", { text: delta });
        }
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Ask failed" });
        controller.close();
        return;
      }

      const citations = extractCitations(answer)
        .map((n) => citationByN.get(n))
        .filter((c): c is NonNullable<typeof c> => c != null);

      await prisma.askMessage.create({
        data: { threadId: thread.id, role: "assistant", text: answer, citations },
      });

      send("done", { citations });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}