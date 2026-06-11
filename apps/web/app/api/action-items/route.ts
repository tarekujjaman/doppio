import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** MVP-05: aggregated tasks view across sessions. */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const doneParam = request.nextUrl.searchParams.get("done");

  const items = await prisma.actionItem.findMany({
    where: {
      session: { userId: user.id },
      ...(doneParam === null ? {} : { done: doneParam === "true" }),
    },
    orderBy: { id: "desc" },
    take: 100,
    include: { session: { select: { id: true, title: true } } },
  });

  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      text: i.text,
      owner: i.owner,
      dueHint: i.dueHint,
      done: i.done,
      session: i.session,
    })),
  });
}
