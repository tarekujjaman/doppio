import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  text: z.string().min(1).max(10_000),
});

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);

  // Ownership enforced through the note → session relation.
  const { count } = await prisma.note.updateMany({
    where: { id, session: { userId: user.id } },
    data: { text: parsed.data.text },
  });
  if (count === 0) return apiError("NOT_FOUND", "Note not found", 404);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const { count } = await prisma.note.deleteMany({
    where: { id, session: { userId: user.id } },
  });
  if (count === 0) return apiError("NOT_FOUND", "Note not found", 404);

  return NextResponse.json({ ok: true });
}
