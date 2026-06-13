"use client";

import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ShareLinkDto {
  id: string;
  token: string;
  scope: string;
  expiresAt: string | null;
  createdAt: string;
}

/** Share links manager (MVP-23/34): create with scope+expiry, copy, revoke. */
export function SharePanel({ sessionId }: { sessionId: string }) {
  const [links, setLinks] = useState<ShareLinkDto[] | null>(null);
  const [scope, setScope] = useState<"summary" | "full">("summary");
  const [expiry, setExpiry] = useState<string>("30");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/sessions/${sessionId}/share`)
      .then((r) => (r.ok ? r.json() : { links: [] }))
      .then((b: { links: ShareLinkDto[] }) => {
        if (!cancelled) setLinks(b.links);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function createLink() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          expiresInDays: expiry === "never" ? null : Number(expiry),
        }),
      });
      const body = (await res.json()) as { link?: ShareLinkDto; error?: { message: string } };
      if (!res.ok || !body.link) throw new Error(body.error?.message ?? "Could not create link");
      setLinks((prev) => [body.link!, ...(prev ?? [])]);
      await copyLink(body.link);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(link: ShareLinkDto) {
    const url = `${location.origin}/share/${link.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function revoke(id: string) {
    const prev = links;
    setLinks((p) => (p ?? []).filter((l) => l.id !== id));
    const res = await fetch(`/api/share-links/${id}`, { method: "DELETE" });
    if (!res.ok) setLinks(prev);
  }

  return (
    <Card className="animate-fade-in">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            What to share
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "summary" | "full")}
              data-testid="share-scope"
              className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="summary">Summary only</option>
              <option value="full">Summary + transcript</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            Expires
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="7">In 7 days</option>
              <option value="30">In 30 days</option>
              <option value="never">Never</option>
            </select>
          </label>
          <Button size="sm" onClick={() => void createLink()} disabled={creating} data-testid="create-share-link">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Create link
          </Button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>

        {links === null ? (
          <p className="text-xs text-slate-400">Loading links…</p>
        ) : links.length === 0 ? (
          <p className="text-xs text-slate-400">
            No active links. Anyone with a link can view without signing in — revoke anytime.
          </p>
        ) : (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                data-testid="share-link-row"
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
                  /share/{link.token}
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {link.scope === "full" ? "Full" : "Summary"} ·{" "}
                  {link.expiresAt
                    ? `until ${new Date(link.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : "no expiry"}
                </span>
                <button
                  onClick={() => void copyLink(link)}
                  aria-label="Copy link"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                >
                  {copiedId === link.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => void revoke(link.id)}
                  aria-label="Revoke link"
                  data-testid="revoke-share-link"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
