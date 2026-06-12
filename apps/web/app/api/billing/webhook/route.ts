import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { createPaymentProvider } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * MVP-17: payment gateway webhook — same `{ providerRef, status }` shape a real
 * bKash webhook will deliver. Real adapters add signature verification inside
 * verifyWebhook; the route logic stays identical.
 */
export async function POST(request: NextRequest) {
  const provider = createPaymentProvider();

  let verified: { providerRef: string; status: "completed" | "failed" };
  try {
    verified = await provider.verifyWebhook(await request.json().catch(() => null));
  } catch (err) {
    return apiError("INVALID_WEBHOOK", err instanceof Error ? err.message : "Invalid webhook", 400);
  }

  const payment = await prisma.payment.findFirst({
    where: { providerRef: verified.providerRef },
  });
  if (!payment) return apiError("NOT_FOUND", "Payment not found", 404);
  if (payment.status !== "initiated") {
    // Idempotent: re-delivered webhooks are acknowledged without re-applying.
    return NextResponse.json({ ok: true, status: payment.status });
  }

  if (verified.status === "failed") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
    return NextResponse.json({ ok: true, status: "failed" });
  }

  // Success: extend from current expiry if still active, else from now (renewal-safe).
  const profile = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { planExpiresAt: true },
  });
  const base =
    profile?.planExpiresAt && profile.planExpiresAt > new Date()
      ? profile.planExpiresAt
      : new Date();
  const expiresAt = new Date(base.getTime() + payment.periodDays * 24 * 3600 * 1000);

  await prisma.$transaction([
    prisma.payment.update({ where: { id: payment.id }, data: { status: "completed" } }),
    prisma.user.update({
      where: { id: payment.userId },
      data: { plan: payment.plan, planExpiresAt: expiresAt },
    }),
  ]);

  return NextResponse.json({ ok: true, status: "completed" });
}
