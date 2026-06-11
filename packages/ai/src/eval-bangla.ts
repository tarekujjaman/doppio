/**
 * `pnpm eval:bangla` — manual MVP-27 check (the only sanctioned real-OpenAI dev spend).
 * Runs summarize/actions prompts against the real LLM for all three fixtures and
 * prints outputs for human review. Implemented fully in M3; guarded stub until then.
 */
const provider = process.env.LLM_PROVIDER ?? "mock";

if (provider !== "openai" || !process.env.OPENAI_API_KEY) {
  console.log("eval:bangla requires LLM_PROVIDER=openai and OPENAI_API_KEY. Skipping (no spend).");
  process.exit(0);
}

console.log("Real-LLM Bangla evaluation lands in M3 (AI pipeline milestone).");
