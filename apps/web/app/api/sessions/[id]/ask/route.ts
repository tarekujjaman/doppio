import { buildAskPrompt, createLLMClient, extractCitations, type AskHistoryTurn } from "@doppio/ai";
import { checkAskQuota, effectivePlan } from "@doppio/core";
import { prisma } from "@doppio/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { retrieveChunks } from "@/lib/pipeline/index-session";
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
 * Ask Doppio (MVP-10/11): single-session RAG with SSE streaming.
 * Events: meta {threadId} → delta {text}* → done {citations:[{segmentIdx,startMs}]}.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);
  if (session.status !== "READY") return apiError("INVALID_STATE", "Session is still processing", 409);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);
  const { question, threadId } = parsed.data;

  // Daily Ask quota (MVP-15).
  const [profile, askCallsToday] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, planExpiresAt: true },
    }),
    prisma.usageLedger.count({
      where: { userId: user.id, kind: "ask_call", createdAt: { gte: dayStart() } },
    }),
  ]);
  const plan = effectivePlan(profile?.plan ?? "FREE", profile?.planExpiresAt);
  if (!checkAskQuota({ plan, userAskCallsToday: askCallsToday }).allowed) {
    return apiError("QUOTA_EXCEEDED", "Daily Ask limit reached — upgrade for more", 402);
  }

  const llm = createLLMClient();

  // Retrieve top-k chunks for grounding.
  const [queryEmbedding] = await llm.embed([question]);
  const chunks = await retrieveChunks(id, queryEmbedding!, 6);
  if (chunks.length === 0) {
    return apiError("NOT_INDEXED", "This session has no searchable index yet", 409);
  }

  // Thread + history (follow-ups, MVP-11).
  const thread = threadId
    ? await prisma.askThread.findFirst({ where: { id: threadId, sessionId: id } })
    : await prisma.askThread.create({ data: { sessionId: id } });
  if (!thread) return apiError("NOT_FOUND", "Thread not found", 404);

  const historyRows = threadId
    ? await prisma.askMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "desc" },
        take: 6,
      })
    : [];
  const history: AskHistoryTurn[] = historyRows
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));

  await prisma.askMessage.create({
    data: { threadId: thread.id, role: "user", text: question },
  });
  await prisma.usageLedger.create({
    data: { userId: user.id, kind: "ask_call", amount: 1, sessionId: id },
  });

  const prompt = buildAskPrompt({
    excerpts: chunks.map((c) => ({ n: c.idx, text: c.text })),
    question,
    history,
  });

  const chunkStartById = new Map(chunks.map((c) => [c.idx, c.startMs ?? 0]));
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

      const citations = extractCitations(answer).map((n) => ({
        segmentIdx: n,
        startMs: chunkStartById.get(n) ?? 0,
      }));

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
