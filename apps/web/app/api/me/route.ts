import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60; // account deletion sweeps storage

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

/**
 * MVP-33: full account deletion — audio objects, app rows (sessions cascade
 * to children), then the Supabase auth user, then this device's session.
 */
export async function DELETE() {
  const user = await getAuthUser();
  if (!user) return err("UNAUTHENTICATED", "Sign in required", 401);

  // 1. Storage: remove every audio object referenced by this user's sessions.
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    select: { audioKey: true },
  });
  const keys = sessions.map((s) => s.audioKey).filter((k): k is string => Boolean(k));
  const admin = createAdminClient();
  if (keys.length > 0) {
    await admin.storage.from("doppio-audio").remove(keys);
  }

  // 2. App rows. Session children cascade; User relations don't, so order matters.
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.usageLedger.deleteMany({ where: { userId: user.id } }),
    prisma.payment.deleteMany({ where: { userId: user.id } }),
    prisma.user.deleteMany({ where: { id: user.id } }),
  ]);

  // 3. Identity + this device's session.
  await admin.auth.admin.deleteUser(user.id);
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
