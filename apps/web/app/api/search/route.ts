import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { searchAll } from "@/lib/search";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** MVP-08/09: keyword search API (the /search page uses lib/search directly). */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ hits: [], query: q ?? "" });
  if (q.length > 200) return apiError("QUERY_TOO_LONG", "Query too long", 400);

  const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
  const to = searchParams.get("to") ? new Date(`${searchParams.get("to")!}T23:59:59`) : null;

  const hits = await searchAll({ userId: user.id, q, from, to });
  return NextResponse.json({ query: q, hits });
}
