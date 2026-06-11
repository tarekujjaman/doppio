import { prisma } from "@doppio/db";
import { Search } from "lucide-react";
import { redirect } from "next/navigation";
import { SessionList } from "@/components/session-list";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const query = q?.trim();

  const sessions = await prisma.session.findMany({
    where: {
      userId: user.id,
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      language: true,
      durationSec: true,
      createdAt: true,
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sessions</h1>
        <form method="get" className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            name="q"
            defaultValue={query ?? ""}
            placeholder="Filter by title…"
            className="pl-9"
          />
        </form>
      </div>

      <SessionList
        sessions={sessions}
        emptyHint={
          query
            ? `No sessions match “${query}”.`
            : "Upload audio from the dashboard to create your first session."
        }
      />
    </div>
  );
}
