import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Paginated session list with server-side title search (MVP-29). */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query")?.trim();
  const cursor = searchParams.get("cursor") ?? undefined;
  const take = Math.min(Number(searchParams.get("take") ?? 20), 50);

  const sessions = await prisma.session.findMany({
    where: {
      userId: user.id,
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      source: true,
      status: true,
      language: true,
      durationSec: true,
      tags: true,
      createdAt: true,
    },
  });

  const nextCursor = sessions.length > take ? sessions.pop()!.id : null;
  return NextResponse.json({ sessions, nextCursor });
}
