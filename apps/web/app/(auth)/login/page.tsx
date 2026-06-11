"use client";

import { ArrowLeft, KeyRound, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Phase = "enter-email" | "check-inbox";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const urlError = params.get("error");

  const [phase, setPhase] = useState<Phase>("enter-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? "That link is invalid or has expired. Please try again." : null,
  );

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
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
    else setPhase("check-inbox");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setBusy(false);
    if (error) setError(error.message);
    else {
      router.push(next);
      router.refresh();
    }
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
              We sent a sign-in link to <strong className="text-slate-700">{email}</strong>. Click
              it, or enter the 6-digit code below.
            </p>
            <form onSubmit={verifyCode} className="mt-6 space-y-3">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="pl-9 text-center text-base tracking-[0.4em]"
                />
              </div>
              <Button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full"
                size="md"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify code
              </Button>
            </form>
            <button
              onClick={() => setPhase("enter-email")}
              className="mt-4 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Use a different email
            </button>
          </>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        By signing in you agree to keep building great things.
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
