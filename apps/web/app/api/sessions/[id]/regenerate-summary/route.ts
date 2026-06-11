import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/** MVP-03: regenerate the summary (and undone action items); keeps title/tags. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { status: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);
  if (session.status !== "READY") {
    return apiError("INVALID_STATE", "Session is still processing", 409);
  }

  const ok = await summarizeSession(id, { setTitleAndTags: false });
  if (!ok) return apiError("SUMMARIZE_FAILED", "Could not generate a summary — try again", 502);

  const summary = await prisma.summary.findUnique({ where: { sessionId: id } });
  return NextResponse.json({ summary });
}
