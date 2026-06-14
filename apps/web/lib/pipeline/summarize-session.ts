import {
  ActionsOutputSchema,
  buildActionsPrompt,
  buildSummarizePrompt,
  createLLMClient,
  safeParseLLMJson,
  SummarizeOutputSchema,
  type TargetLanguage,
} from "@doppio/ai";
import { prisma } from "@doppio/db";

/**
 * Summary + title + tags + action items (MVP-01/02/04/07).
 * Shared by the upload pipeline, text import, and the regenerate endpoint.
 * Returns false when the LLM output could not be parsed — callers degrade
 * gracefully (session still becomes READY; summary can be regenerated).
 */
export async function summarizeSession(
  sessionId: string,
  opts: { setTitleAndTags: boolean },
): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { transcript: { orderBy: { idx: "asc" } } },
  });
  if (!session || session.transcript.length === 0) return false;

  // Cap prompt size: ~100k chars ≈ 25k tokens, well inside gpt-4o-mini context.
  const transcript = session.transcript
    .map((s) => s.text)
    .join("\n")
    .slice(0, 100_000);

  // Product decision: summaries, action items, title, and tags are always in
  // English regardless of the transcript's language (the transcript itself stays
  // in whatever language was spoken).
  const targetLanguage: TargetLanguage = "en";

  const llm = createLLMClient();

  const [sumRes, actRes] = await Promise.all([
    llm.complete({ ...buildSummarizePrompt({ transcript, targetLanguage }), json: true }),
    llm.complete({ ...buildActionsPrompt({ transcript, targetLanguage }), json: true }),
  ]);

  const summary = safeParseLLMJson(sumRes.text, SummarizeOutputSchema);
  const actions = safeParseLLMJson(actRes.text, ActionsOutputSchema);
  if (!summary) return false;

  const tokensUsed =
    sumRes.usage.inputTokens +
    sumRes.usage.outputTokens +
    actRes.usage.inputTokens +
    actRes.usage.outputTokens;

  await prisma.$transaction([
    prisma.summary.upsert({
      where: { sessionId },
      update: {
        overview: summary.overview,
        decisions: summary.decisions ?? null,
        nextSteps: summary.nextSteps ?? null,
        language: targetLanguage,
        model: sumRes.model,
        tokensUsed,
      },
      create: {
        sessionId,
        overview: summary.overview,
        decisions: summary.decisions ?? null,
        nextSteps: summary.nextSteps ?? null,
        language: targetLanguage,
        model: sumRes.model,
        tokensUsed,
      },
    }),
    prisma.actionItem.deleteMany({ where: { sessionId, done: false } }),
    ...(actions && actions.items.length > 0
      ? [
          prisma.actionItem.createMany({
            data: actions.items.map((i) => ({
              sessionId,
              text: i.text,
              owner: i.owner ?? null,
              dueHint: i.dueHint ?? null,
            })),
          }),
        ]
      : []),
    ...(opts.setTitleAndTags
      ? [
          prisma.session.update({
            where: { id: sessionId },
            data: { title: summary.title.slice(0, 300), tags: summary.tags.slice(0, 6) },
          }),
        ]
      : []),
    prisma.usageLedger.create({
      data: { userId: session.userId, kind: "summary_call", amount: tokensUsed, sessionId },
    }),
  ]);

  return true;
}
