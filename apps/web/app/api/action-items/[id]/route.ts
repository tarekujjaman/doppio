import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PatchSchema = z.object({
  done: z.boolean().optional(),
  text: z.string().min(1).max(2_000).optional(),
});

/** MVP-05: check off / edit an action item. */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);

  const { count } = await prisma.actionItem.updateMany({
    where: { id, session: { userId: user.id } },
    data: parsed.data,
  });
  if (count === 0) return apiError("NOT_FOUND", "Action item not found", 404);

  return NextResponse.json({ ok: true });
}
