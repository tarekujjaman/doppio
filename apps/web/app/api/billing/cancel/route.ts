import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * MVP-19: cancel = no immediate downgrade; PRO stays active until planExpiresAt
 * and simply doesn't renew (sandbox has no auto-renew to revoke).
 */
export async function POST() {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, planExpiresAt: true },
  });
  if (profile?.plan !== "PRO") {
    return apiError("NOT_PRO", "No active Pro subscription to cancel", 400);
  }

  return NextResponse.json({
    ok: true,
    activeUntil: profile.planExpiresAt,
    message: "Pro stays active until the period ends and will not renew.",
  });
}
