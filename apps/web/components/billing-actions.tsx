"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UpgradeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "PRO" }),
      });
      const body = (await res.json()) as { paymentUrl?: string; error?: { message: string } };
      if (!res.ok || !body.paymentUrl) throw new Error(body.error?.message ?? "Checkout failed");
      router.push(body.paymentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => void upgrade()} disabled={busy} data-testid="upgrade-button">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Upgrade to Pro
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

export function CancelButton({ activeUntil }: { activeUntil: string | null }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    if (!confirm("Cancel Pro? It stays active until the period ends, then will not renew.")) return;
    setBusy(true);
    const res = await fetch("/api/billing/cancel", { method: "POST" });
    setBusy(false);
    if (res.ok) setDone(true);
  }

  if (done) {
    return (
      <p className="text-sm text-slate-500">
        Cancelled — Pro stays active until{" "}
        {activeUntil ? new Date(activeUntil).toLocaleDateString("en-US", { dateStyle: "medium" }) : "the period ends"}
        , then won’t renew.
      </p>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void cancel()} disabled={busy}>
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      Cancel subscription
    </Button>
  );
}
