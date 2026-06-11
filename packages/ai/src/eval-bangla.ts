/**
 * `pnpm eval:bangla` — manual MVP-27 check (the only sanctioned real-OpenAI dev spend).
 * Runs summarize + actions prompts against the REAL LLM for the Bangla, English,
 * and code-switched fixtures and prints outputs for human review.
 *
 * Usage: LLM_PROVIDER=openai OPENAI_API_KEY=sk-... pnpm eval:bangla
 */
import { FIXTURES } from "@doppio/stt";
import { createLLMClient } from "./index";
import { safeParseLLMJson } from "./parse";
import { buildActionsPrompt } from "./prompts/actions";
import { buildSummarizePrompt, type TargetLanguage } from "./prompts/summarize";
import { ActionsOutputSchema, SummarizeOutputSchema } from "./types";

const provider = process.env.LLM_PROVIDER ?? "mock";
if (provider !== "openai" || !process.env.OPENAI_API_KEY) {
  console.log("eval:bangla requires LLM_PROVIDER=openai and OPENAI_API_KEY. Skipping (no spend).");
  process.exit(0);
}

const BANGLA_RE = /[ঀ-৿]/;

async function main() {
  const llm = createLLMClient();
  let totalTokens = 0;
  let failures = 0;

  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const transcript = fixture.segments.map((s) => s.text).join("\n");
    const targetLanguage: TargetLanguage = name === "en" ? "en" : "bn";

    console.log(`\n${"=".repeat(60)}\nFIXTURE: ${name} (target language: ${targetLanguage})\n`);

    const sumPrompt = buildSummarizePrompt({ transcript, targetLanguage });
    const sumRes = await llm.complete({ ...sumPrompt, json: true });
    totalTokens += sumRes.usage.inputTokens + sumRes.usage.outputTokens;
    const summary = safeParseLLMJson(sumRes.text, SummarizeOutputSchema);

    if (!summary) {
      console.log("✗ SUMMARY PARSE FAILED:", sumRes.text.slice(0, 400));
      failures++;
    } else {
      console.log("Title:   ", summary.title);
      console.log("Overview:", summary.overview);
      if (summary.decisions) console.log("Decisions:", summary.decisions);
      if (summary.nextSteps) console.log("Next:    ", summary.nextSteps);
      console.log("Tags:    ", summary.tags.join(", "));
      if (targetLanguage === "bn" && !BANGLA_RE.test(summary.overview)) {
        console.log("✗ MVP-27 FAIL: Bangla input produced a non-Bangla overview!");
        failures++;
      } else {
        console.log("✓ language contract held");
      }
    }

    const actPrompt = buildActionsPrompt({ transcript, targetLanguage });
    const actRes = await llm.complete({ ...actPrompt, json: true });
    totalTokens += actRes.usage.inputTokens + actRes.usage.outputTokens;
    const actions = safeParseLLMJson(actRes.text, ActionsOutputSchema);

    if (!actions) {
      console.log("✗ ACTIONS PARSE FAILED:", actRes.text.slice(0, 400));
      failures++;
    } else {
      console.log(
        "Actions: ",
        actions.items.length === 0
          ? "(none)"
          : actions.items
              .map((i) => `${i.text}${i.owner ? ` [${i.owner}]` : ""}${i.dueHint ? ` (${i.dueHint})` : ""}`)
              .join(" | "),
      );
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total tokens: ${totalTokens} (≈$${((totalTokens / 1_000_000) * 0.4).toFixed(4)})`);
  console.log(failures === 0 ? "ALL CHECKS PASSED ✓" : `${failures} FAILURE(S) ✗`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
