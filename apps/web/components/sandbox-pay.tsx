"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/lib/use-hydrated";

/** Sandbox gateway controls — posts the same webhook a real MFS gateway would. */
export function SandboxPay({ providerRef }: { providerRef: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<"completed" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function simulate(status: "completed" | "failed") {
    setBusy(status);
    setError(null);
    try {
      const res = await fetch("/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerRef, status }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message: string } } | null;
        throw new Error(body?.error?.message ?? "Webhook failed");
      }
      router.push(status === "completed" ? "/billing?paid=1" : "/billing?failed=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => void simulate("completed")}
        disabled={busy !== null}
        className="w-full"
        data-testid="simulate-success"
        data-hydrated={hydrated ? "true" : "false"}
      >
        {busy === "completed" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Simulate successful payment
      </Button>
      <Button
        onClick={() => void simulate("failed")}
        disabled={busy !== null}
        variant="outline"
        className="w-full"
      >
        {busy === "failed" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="h-4 w-4" />
        )}
        Simulate failed payment
      </Button>
      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
