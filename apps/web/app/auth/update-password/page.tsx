"use client";

import { KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page for password-recovery links (reached via /auth/callback, which
 * has already exchanged the recovery code for a session).
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        /password should be at least/i.test(error.message)
          ? "Password must be at least 8 characters."
          : error.message,
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="bg-hero-glow flex min-h-screen flex-col items-center justify-center px-4">
      <Link href="/" className="mb-8 text-2xl font-bold tracking-tight text-primary-800">
        Doppio
      </Link>

      <div className="w-full max-w-sm animate-fade-up rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Choose a new password</h1>

        {hasSession === false ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            This page only works right after opening a password-reset link.{" "}
            <Link href="/login" className="font-medium text-primary-700 hover:text-primary-800">
              Back to sign in
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <Input
              type="password"
              required
              minLength={8}
              autoFocus
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password (8+ characters)"
            />
            <Button type="submit" disabled={busy || hasSession === null} className="w-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save password &amp; continue
            </Button>
          </form>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
