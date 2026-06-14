"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { WorkspaceSummary } from "./types";

/** Summary tab with regenerate (MVP-03). */
export function SummaryPanel({
  sessionId,
  summary,
  processing,
  onUpdated,
}: {
  sessionId: string;
  summary: WorkspaceSummary | null;
  processing: boolean;
  onUpdated: (summary: WorkspaceSummary) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/regenerate-summary`, { method: "POST" });
      const body = (await res.json().catch(() => null)) as
        | { summary?: WorkspaceSummary; error?: { message: string } }
        | null;
      if (!res.ok || !body?.summary) {
        throw new Error(body?.error?.message ?? "Could not regenerate the summary.");
      }
      onUpdated(body.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="space-y-4 text-sm leading-relaxed text-slate-700">
          <p data-testid="summary-overview">{summary.overview}</p>
          {summary.detail && (
            <div
              className="
                rounded-lg border border-slate-100 bg-slate-50/50 p-4
                [&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-slate-900 first:[&_h2]:mt-0
                [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-slate-500
                [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul_ul]:mt-0.5
                [&_li]:mt-0.5 [&_p]:my-1.5 [&_strong]:font-semibold [&_strong]:text-slate-900
              "
              data-testid="summary-detail"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary.detail}</ReactMarkdown>
            </div>
          )}
          {!summary.detail && summary.decisions && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Decisions
              </p>
              <p>{summary.decisions}</p>
            </div>
          )}
          {!summary.detail && summary.nextSteps && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Next steps
              </p>
              <p>{summary.nextSteps}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-slate-400">
          {processing ? "Summary coming up…" : "No summary yet — generate one below."}
        </p>
      )}

      {!processing && (
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {summary ? "Regenerate" : "Generate summary"}
          </Button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
