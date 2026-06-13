import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Revoke a share link (ownership via the link → session relation). */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const { count } = await prisma.shareLink.updateMany({
    where: { id, session: { userId: user.id } },
    data: { revoked: true },
  });
  if (count === 0) return apiError("NOT_FOUND", "Share link not found", 404);

  return NextResponse.json({ ok: true });
}
