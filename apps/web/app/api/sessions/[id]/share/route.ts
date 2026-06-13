import { randomBytes } from "node:crypto";
import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const CreateSchema = z.object({
  scope: z.enum(["summary", "full"]).default("summary"),
  expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
});

/** MVP-23/34: list this session's active share links. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);

  const links = await prisma.shareLink.findMany({
    where: { sessionId: id, revoked: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, scope: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ links });
}

/** Creates a share link (scope + optional expiry). */
export async function POST(request: NextRequest, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);

  const link = await prisma.shareLink.create({
    data: {
      sessionId: id,
      token: randomBytes(16).toString("base64url"),
      scope: parsed.data.scope,
      expiresAt: parsed.data.expiresInDays
        ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 3600 * 1000)
        : null,
    },
    select: { id: true, token: true, scope: true, expiresAt: true, createdAt: true },
  });

  return NextResponse.json({ link }, { status: 201 });
}
