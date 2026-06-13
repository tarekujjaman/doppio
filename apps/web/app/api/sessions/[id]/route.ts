import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { deleteAudio } from "@/lib/storage";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Full session detail: transcript + summary + actions + notes (MVP-30). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    include: {
      transcript: { orderBy: { idx: "asc" } },
      summary: true,
      actionItems: true,
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);

  // hasAudio drives the player; audio is discarded after transcription, so this
  // is normally false once READY (only transcript + summary are kept).
  return NextResponse.json({ session: { ...session, hasAudio: Boolean(session.audioKey) } });
}

const PatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  tags: z.array(z.string().min(1).max(50)).max(10).optional(),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);

  const { count } = await prisma.session.updateMany({
    where: { id, userId: user.id },
    data: parsed.data,
  });
  if (count === 0) return apiError("NOT_FOUND", "Session not found", 404);

  return NextResponse.json({ ok: true });
}

/** Delete with cascade + Storage cleanup (INIT-17). */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { audioKey: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);

  if (session.audioKey) await deleteAudio(session.audioKey).catch(() => {});
  await prisma.session.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
