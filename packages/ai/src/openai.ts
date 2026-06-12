import type { LLMClient, LLMCompletion } from "./types";

interface ChatResponse {
  choices: { message: { content: string | null } }[];
  usage?: { prompt_tokens: number; completion_tokens: number };
  model: string;
}

interface EmbeddingResponse {
  data: { embedding: number[] }[];
}

/** OpenAI-backed LLM: gpt-4o-mini for text, text-embedding-3-small (1536-dim). */
export class OpenAiLLMClient implements LLMClient {
  readonly name = "openai";

  constructor(
    private readonly opts: {
      apiKey: string;
      model?: string;
      embedModel?: string;
    },
  ) {}

  async complete(input: {
    system: string;
    user: string;
    maxTokens?: number;
    json?: boolean;
  }): Promise<LLMCompletion> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.opts.model ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        max_tokens: input.maxTokens ?? 1024,
        ...(input.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI completion failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as ChatResponse;
    return {
      text: data.choices[0]?.message.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model,
    };
  }

  async *streamComplete(input: {
    system: string;
    user: string;
    maxTokens?: number;
  }): AsyncIterable<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.opts.model ?? "gpt-4o-mini",
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        max_tokens: input.maxTokens ?? 1024,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI stream failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.trim().replace(/^data:\s*/, "");
        if (!data || data === "[DONE]" || !line.startsWith("data:")) continue;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // partial frame — ignored, next read completes it
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.opts.embedModel ?? "text-embedding-3-small",
        input: texts,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`OpenAI embeddings failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as EmbeddingResponse;
    return data.data.map((d) => d.embedding);
  }
}
