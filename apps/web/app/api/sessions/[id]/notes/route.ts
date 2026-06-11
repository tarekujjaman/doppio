import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  text: z.string().min(1).max(10_000),
  anchorMs: z.number().int().nonnegative().nullable().optional(),
});

/** MVP-06: add a note, optionally anchored to a transcript timestamp. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);

  const note = await prisma.note.create({
    data: { sessionId: id, text: parsed.data.text, anchorMs: parsed.data.anchorMs ?? null },
  });

  return NextResponse.json({ note }, { status: 201 });
}
