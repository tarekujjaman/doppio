"use client";

import { Check, Download, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

export interface SettingsProfile {
  email: string | null;
  name: string | null;
  privateMode: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsProfile }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [name, setName] = useState(initial.name ?? "");
  const [privateMode, setPrivateMode] = useState(initial.privateMode);
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === (initial.name ?? "")) return;
    setSavingName(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    setSavingName(false);
    if (res.ok) {
      setSavedName(true);
      setTimeout(() => setSavedName(false), 2000);
    }
  }

  async function togglePrivateMode() {
    const next = !privateMode;
    setPrivateMode(next);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privateMode: next }),
    });
    if (!res.ok) setPrivateMode(!next);
  }

  async function deleteAccount() {
    const phrase = window.prompt(
      'This permanently deletes your account, all sessions, transcripts, and audio. Type "DELETE" to confirm.',
    );
    if (phrase !== "DELETE") return;
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/me", { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      setDeleting(false);
      setError("Account deletion failed — please try again.");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2" data-hydrated={hydrated ? "true" : "false"} data-testid="settings-root">
      {/* Profile */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <UserRound className="h-4 w-4 text-slate-400" />
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
            <p className="text-sm text-slate-700">{initial.email ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Display name
            </p>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                data-testid="name-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveName();
                }}
              />
              <Button
                variant="outline"
                onClick={() => void saveName()}
                disabled={savingName}
                data-testid="save-name"
              >
                {savingName ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : savedName ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacy */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-slate-400" />
          <CardTitle>Privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            onClick={() => void togglePrivateMode()}
            data-testid="private-mode-toggle"
            role="switch"
            aria-checked={privateMode}
            className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-300"
          >
            <span>
              <span className="block text-sm font-medium text-slate-900">
                Private mode by default
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                New sessions discard the audio file right after transcription — only the transcript
                is kept.
              </span>
            </span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                privateMode ? "bg-primary-700" : "bg-slate-200",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                  privateMode ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <Download className="h-4 w-4 text-slate-400" />
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-3">
            Download everything — profile, sessions, transcripts, summaries, notes, payments — as
            JSON.
          </CardDescription>
          <a
            href="/api/me/export"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
            data-testid="export-data"
          >
            <Download className="h-4 w-4" />
            Export my data
          </a>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-100">
        <CardHeader className="flex-row items-center gap-2">
          <Trash2 className="h-4 w-4 text-red-400" />
          <CardTitle className="text-red-700">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-3">
            Permanently delete your account, every session, transcript, and audio file. This cannot
            be undone.
          </CardDescription>
          <Button
            variant="danger"
            size="sm"
            onClick={() => void deleteAccount()}
            disabled={deleting}
            data-testid="delete-account"
          >
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete account
          </Button>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
