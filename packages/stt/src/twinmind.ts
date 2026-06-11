import type { SttInput, SttProvider, SttResult, SttSegment } from "./types";

/**
 * TwinMind Ear-3 adapter (primary): $0.23/hr, native Bangla–English code-switch,
 * speaker labels, files up to 100MB. The API is async-batch, so this adapter
 * submits the job and block-polls until it completes (the caller's serverless
 * budget bounds the wait — fine for short clips; long files need the queue seam).
 *
 * TODO(verify): response field names are mapped defensively (job id, status,
 * segment shapes); confirm against the live API during the real-STT validation pass.
 */
export class TwinMindSttProvider implements SttProvider {
  readonly name = "twinmind";

  constructor(
    private readonly opts: {
      apiKey: string;
      apiBase?: string;
      pollIntervalMs?: number;
      maxWaitMs?: number;
    },
  ) {}

  private get base() {
    return (this.opts.apiBase ?? "https://api.twinmind.com/v1").replace(/\/$/, "");
  }

  private headers() {
    return { Authorization: `Bearer ${this.opts.apiKey}` };
  }

  async transcribeFile(input: SttInput): Promise<SttResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([input.audio.data as BlobPart], { type: input.audio.contentType }),
      input.audio.filename,
    );
    form.append("language", input.languageHint && input.languageHint !== "auto" ? input.languageHint : "auto");
    form.append("diarization", "true");

    const submit = await fetch(`${this.base}/async/transcribe`, {
      method: "POST",
      headers: this.headers(),
      body: form,
    });
    if (!submit.ok) {
      const body = await submit.text().catch(() => "");
      throw new Error(`TwinMind submit failed (${submit.status}): ${body.slice(0, 300)}`);
    }

    const job = (await submit.json()) as Record<string, unknown>;
    // Some APIs return the result synchronously for tiny files.
    const immediate = this.tryParseResult(job);
    if (immediate) return immediate;

    const jobId = (job.job_id ?? job.jobId ?? job.id) as string | undefined;
    if (!jobId) {
      throw new Error(`TwinMind: no job id in response: ${JSON.stringify(job).slice(0, 300)}`);
    }

    return this.pollJob(jobId);
  }

  private async pollJob(jobId: string): Promise<SttResult> {
    const interval = this.opts.pollIntervalMs ?? 5000;
    const deadline = Date.now() + (this.opts.maxWaitMs ?? 240_000);

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, interval));

      const res = await fetch(`${this.base}/async/transcribe/${jobId}`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`TwinMind poll failed (${res.status}): ${body.slice(0, 300)}`);
      }

      const data = (await res.json()) as Record<string, unknown>;
      const status = String(data.status ?? data.state ?? "").toLowerCase();

      if (["failed", "error", "cancelled"].includes(status)) {
        throw new Error(`TwinMind job ${jobId} failed: ${JSON.stringify(data).slice(0, 300)}`);
      }

      const result = this.tryParseResult(data);
      if (result && (status === "" || ["completed", "done", "succeeded", "success"].includes(status))) {
        return result;
      }
    }

    throw new Error(`TwinMind job ${jobId} timed out waiting for completion`);
  }

  /** Maps the segment list out of whichever envelope the API uses. */
  private tryParseResult(data: Record<string, unknown>): SttResult | null {
    const container = (data.result ?? data.output ?? data) as Record<string, unknown>;
    const raw =
      container.segments ?? container.utterances ?? container.transcript ?? container.transcription;
    if (!Array.isArray(raw) || raw.length === 0) return null;

    const segments: SttSegment[] = [];
    for (const item of raw as Record<string, unknown>[]) {
      const text = String(item.text ?? item.content ?? "").trim();
      if (!text) continue;
      const start = Number(item.start_ms ?? item.startMs ?? item.start ?? 0);
      const end = Number(item.end_ms ?? item.endMs ?? item.end ?? start);
      // Heuristic: values under 10000 with fractions are seconds, not ms.
      const isSeconds = !Number.isInteger(start) || (end > 0 && end < 10_000 && "start" in item);
      segments.push({
        startMs: Math.round(isSeconds ? start * 1000 : start),
        endMs: Math.round(isSeconds ? end * 1000 : end),
        text,
        speaker: item.speaker != null ? String(item.speaker) : undefined,
      });
    }
    if (segments.length === 0) return null;

    const language = String(container.language ?? data.language ?? "unknown");
    return { language, segments };
  }
}
