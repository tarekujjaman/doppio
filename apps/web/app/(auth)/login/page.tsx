"use client";

import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/lib/use-hydrated";

type Mode = "signin" | "signup" | "magic" | "magic-sent" | "reset-sent";

/** Specific, recoverable guidance per link failure mode (see /auth/callback). */
const LINK_ERRORS: Record<string, string> = {
  otp_expired:
    "That link has expired or was already used — some email apps pre-open links for security scanning. Request a fresh one and click it promptly.",
  cross_device:
    "That link was opened in a different browser than the one that requested it. Open it in the same browser, or just sign in with your password here.",
  invalid_link: "That link is incomplete. Use the latest email, or sign in with your password.",
  auth_failed: "Sign-in didn't complete. Try your password, or request a fresh link.",
};

function friendlyError(message: string): string {
  if (/rate limit|too many/i.test(message)) {
    return "Email limit reached — the free email service allows only a couple of emails per hour. Use password sign-in, or wait a bit.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Wrong email or password. If you previously signed in via email link, use “Forgot password?” to set a password first.";
  }
  if (/already registered/i.test(message)) {
    return "This email already has an account — sign in instead (or reset the password if you never set one).";
  }
  if (/password should be at least/i.test(message)) {
    return "Password must be at least 8 characters.";
  }
  return message;
}

function LoginForm() {
  const router = useRouter();
  const hydrated = useHydrated();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const urlError = params.get("error");

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? (LINK_ERRORS[urlError] ?? LINK_ERRORS.auth_failed!) : null,
  );

  function redirectUrl(target: string) {
    return `${location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    const { error } =
      mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    setBusy(false);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function sendMagicLink(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl(next) },
    });
    setBusy(false);
    if (error) setError(friendlyError(error.message));
    else setMode("magic-sent");
  }

  async function sendReset() {
    if (!email) {
      setError("Enter your email above first, then tap “Forgot password?” again.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl("/auth/update-password"),
    });
    setBusy(false);
    if (error) setError(friendlyError(error.message));
    else setMode("reset-sent");
  }

  const isInbox = mode === "magic-sent" || mode === "reset-sent";

  return (
    <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 text-2xl font-bold tracking-tight text-primary-800">
        Doppio
      </Link>

      <div className="w-full max-w-sm animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
        {isInbox ? (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <MailCheck className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-xl font-semibold text-slate-900">Check your inbox</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {mode === "magic-sent" ? (
                <>
                  We sent a sign-in link to <strong className="text-slate-700">{email}</strong>.
                  Open it in this browser.
                </>
              ) : (
                <>
                  We sent a password-reset link to{" "}
                  <strong className="text-slate-700">{email}</strong>. Open it, then choose a new
                  password.
                </>
              )}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              Nothing arriving? Check spam. The free email service sends at most a couple of emails
              per hour.
            </p>
            <button
              onClick={() => setMode("signin")}
              className="mt-5 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </button>
          </>
        ) : mode === "magic" ? (
          <>
            <h1 className="text-xl font-semibold text-slate-900">Email me a link</h1>
            <p className="mt-1 text-sm text-slate-500">
              No password needed — we&apos;ll send a one-time sign-in link.
            </p>
            <form onSubmit={sendMagicLink} className="mt-6 space-y-4">
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send sign-in link
              </Button>
            </form>
            <button
              onClick={() => setMode("signin")}
              className="mt-4 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Use password instead
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900">
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {mode === "signup"
                ? "Free to start — no card needed."
                : "Sign in with your email and password."}
            </p>

            <form onSubmit={submitPassword} className="mt-6 space-y-3">
              <Input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                data-testid="email-input"
              />
              <Input
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
                data-testid="password-input"
              />
              <Button
                type="submit"
                disabled={busy}
                className="w-full"
                data-testid="auth-submit"
                data-hydrated={hydrated ? "true" : "false"}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm">
              {mode === "signin" ? (
                <>
                  <button
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="font-medium text-primary-700 transition hover:text-primary-800"
                    data-testid="goto-signup"
                  >
                    Create account
                  </button>
                  <button
                    onClick={() => void sendReset()}
                    disabled={busy}
                    className="text-slate-500 transition hover:text-slate-700"
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMode("signin");
                    setError(null);
                  }}
                  className="font-medium text-primary-700 transition hover:text-primary-800"
                >
                  I already have an account
                </button>
              )}
            </div>

            <div className="mt-5 border-t border-slate-100 pt-4 text-center">
              <button
                onClick={() => {
                  setMode("magic");
                  setError(null);
                }}
                className="text-sm text-slate-500 transition hover:text-slate-700"
              >
                Or email me a sign-in link →
              </button>
            </div>
          </>
        )}

        {error && (
          <p
            data-testid="auth-error"
            className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        {mode === "signup" ? "Your data stays yours — export or delete anytime." : " "}
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
