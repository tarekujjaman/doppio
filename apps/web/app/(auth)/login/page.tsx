"use client";

import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Phase = "enter-email" | "check-inbox";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const urlError = params.get("error");

  const [phase, setPhase] = useState<Phase>("enter-email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "That link is invalid or has expired. Please try again." : null,
  );

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (error) setError(error.message);
    else if (phase === "check-inbox") setResent(true);
    else setPhase("check-inbox");
  }

  return (
    <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 text-2xl font-bold tracking-tight text-primary-800">
        Doppio
      </Link>

      <div className="w-full max-w-sm animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
        {phase === "enter-email" ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in with your email — no password needed.
            </p>
            <form onSubmit={sendLink} className="mt-6 space-y-4">
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button type="submit" disabled={busy} className="w-full" size="md">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send sign-in link
              </Button>
            </form>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MailCheck className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Check your inbox</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              We sent a sign-in link to <strong className="text-slate-700">{email}</strong>.
              Click it and you&apos;ll land right on your dashboard — this tab can be closed.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Nothing arriving? Check spam, or resend below (a new link replaces the old one).
            </p>
            <div className="mt-5 flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void sendLink()}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {resent ? "Sent again ✓" : "Resend link"}
              </Button>
              <button
                onClick={() => {
                  setPhase("enter-email");
                  setResent(false);
                }}
                className="inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Different email
              </button>
            </div>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Sign-in links are valid for one hour and can be used once.
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
