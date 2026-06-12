import { PRO_PERIOD_DAYS, PRO_PRICE_BDT } from "@doppio/core";
import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { createPaymentProvider } from "@/lib/payments";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({ plan: z.literal("PRO") });

/** MVP-16/17: create a Payment(initiated) and hand back the gateway URL. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", "plan must be \"PRO\"", 400);

  const provider = createPaymentProvider();
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: provider.name,
      amountBdt: PRO_PRICE_BDT,
      status: "initiated",
      plan: "PRO",
      periodDays: PRO_PERIOD_DAYS,
    },
  });

  const { paymentUrl, providerRef } = await provider.createCheckout(payment);
  await prisma.payment.update({ where: { id: payment.id }, data: { providerRef } });

  return NextResponse.json({ paymentId: payment.id, paymentUrl });
}
