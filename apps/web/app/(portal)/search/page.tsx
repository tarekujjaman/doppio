import { FileAudio, Search, StickyNote, Type } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SearchSnippet } from "@/components/search-snippet";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchAll, type SearchHit } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

const KIND_ICON = { segment: FileAudio, note: StickyNote, title: Type } as const;

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q, from, to } = await searchParams;
  const query = q?.trim() ?? "";

  const hits: SearchHit[] =
    query.length >= 2
      ? await searchAll({
          userId: user.id,
          q: query,
          from: from ? new Date(from) : null,
          to: to ? new Date(`${to}T23:59:59`) : null,
        })
      : [];

  // Group hits by session for a scannable result list.
  const groups = new Map<string, { title: string; hits: SearchHit[] }>();
  for (const hit of hits) {
    const g = groups.get(hit.sessionId) ?? { title: hit.sessionTitle, hits: [] };
    g.hits.push(hit);
    groups.set(hit.sessionId, g);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Search</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search every word ever said…"
            className="pl-9"
            autoFocus
          />
        </div>
        <label className="text-xs text-slate-500">
          From
          <Input type="date" name="from" defaultValue={from ?? ""} className="mt-1 h-9 w-36" />
        </label>
        <label className="text-xs text-slate-500">
          To
          <Input type="date" name="to" defaultValue={to ?? ""} className="mt-1 h-9 w-36" />
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary-800 px-4 text-sm font-medium text-white transition hover:bg-primary-700"
        >
          Search
        </button>
      </form>

      {query.length >= 2 && groups.size === 0 && (
        <Card className="border-dashed shadow-none">
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No matches for “{query}”.
          </div>
        </Card>
      )}

      {[...groups.entries()].map(([sessionId, group]) => (
        <Card key={sessionId} className="overflow-hidden">
          <Link
            href={`/sessions/${sessionId}`}
            className="block border-b border-slate-100 bg-slate-50/60 px-5 py-3 font-medium text-slate-900 transition hover:text-primary-700"
          >
            {group.title}
          </Link>
          <ul className="divide-y divide-slate-50">
            {group.hits.map((hit, i) => {
              const Icon = KIND_ICON[hit.kind];
              return (
                <li key={i}>
                  <Link
                    href={`/sessions/${sessionId}${hit.startMs !== null ? `?t=${hit.startMs}` : ""}`}
                    data-testid="search-hit"
                    className="flex items-start gap-3 px-5 py-3 transition hover:bg-slate-50"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    <span className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">
                      <SearchSnippet text={hit.snippet} />
                    </span>
                    {hit.startMs !== null && (
                      <span className="shrink-0 font-mono text-xs text-primary-600">
                        {fmtMs(hit.startMs)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
