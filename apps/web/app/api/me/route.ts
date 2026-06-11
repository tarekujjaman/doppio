import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const err = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message } }, { status });

/** Profile fetch — upserts the app profile on first authenticated request. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return err("UNAUTHENTICATED", "Sign in required", 401);

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email ?? undefined },
    create: { id: user.id, email: user.email ?? null },
  });

  return NextResponse.json({
    id: profile.id,
    email: profile.email,
    name: profile.name,
    locale: profile.locale,
    privateMode: profile.privateMode,
    plan: profile.plan,
    planExpiresAt: profile.planExpiresAt,
  });
}

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  locale: z.enum(["bn", "en"]).optional(),
  privateMode: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return err("UNAUTHENTICATED", "Sign in required", 401);

  const body = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return err("INVALID_BODY", body.error.message, 400);

  const profile = await prisma.user.upsert({
    where: { id: user.id },
    update: body.data,
    create: { id: user.id, email: user.email ?? null, ...body.data },
  });

  return NextResponse.json({ ok: true, locale: profile.locale });
}
