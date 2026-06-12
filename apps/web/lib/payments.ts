import { prisma, type Payment } from "@doppio/db";

/**
 * Payment abstraction (MVP-17 seam): the sandbox provider mirrors the shape a
 * real bKash adapter will use — same checkout/webhook lifecycle — so swapping
 * in real MFS credentials later is an adapter drop-in, not a refactor.
 */
export interface PaymentProvider {
  readonly name: string;
  /** Creates the provider-side checkout and returns the URL to send the user to. */
  createCheckout(payment: Payment): Promise<{ paymentUrl: string; providerRef: string }>;
  /** Validates an incoming webhook payload; returns the referenced payment id. */
  verifyWebhook(payload: unknown): Promise<{ providerRef: string; status: "completed" | "failed" }>;
}

class SandboxProvider implements PaymentProvider {
  readonly name = "sandbox";

  async createCheckout(payment: Payment) {
    // The sandbox "gateway" is our own page with simulate buttons.
    return {
      paymentUrl: `/billing/sandbox/${payment.id}`,
      providerRef: `sandbox_${payment.id}`,
    };
  }

  async verifyWebhook(payload: unknown) {
    const p = payload as { providerRef?: string; status?: string };
    if (!p?.providerRef || !["completed", "failed"].includes(p.status ?? "")) {
      throw new Error("Invalid webhook payload");
    }
    // Real adapters verify signatures here; sandbox verifies the payment exists.
    const payment = await prisma.payment.findFirst({ where: { providerRef: p.providerRef } });
    if (!payment) throw new Error("Unknown providerRef");
    return { providerRef: p.providerRef, status: p.status as "completed" | "failed" };
  }
}

export function createPaymentProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER ?? "sandbox";
  switch (name) {
    case "sandbox":
      return new SandboxProvider();
    default:
      // bkash | nagad | rocket adapters drop in here (MVP-17/18)
      throw new Error(`Payment provider "${name}" not implemented yet`);
  }
}
