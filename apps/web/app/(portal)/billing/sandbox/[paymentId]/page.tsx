import { prisma } from "@doppio/db";
import { FlaskConical } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { SandboxPay } from "@/components/sandbox-pay";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

/** Stand-in for the bKash/Nagad/Rocket gateway page (MVP-17 sandbox). */
export default async function SandboxPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { paymentId } = await params;
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId: user.id },
  });
  if (!payment || !payment.providerRef) notFound();

  return (
    <div className="mx-auto max-w-md animate-fade-in space-y-6 pt-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 text-accent-600">
          <FlaskConical className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Sandbox payment</h1>
        <p className="mt-1 text-sm text-slate-500">
          This simulates the mobile-money gateway. Real bKash/Nagad/Rocket drop in behind the same
          webhook.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-4">
            <span className="text-sm text-slate-500">Doppio {payment.plan} · 30 days</span>
            <span className="text-2xl font-bold text-slate-900">৳{payment.amountBdt}</span>
          </div>
          {payment.status === "initiated" ? (
            <SandboxPay providerRef={payment.providerRef} />
          ) : (
            <p className="py-2 text-center text-sm text-slate-500">
              This payment is already <strong>{payment.status}</strong>.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
