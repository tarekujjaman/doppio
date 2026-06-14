import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addNote,
  getSessionDetail,
  getSessionStatus,
  listSessions,
  type SessionSummary,
  sessionUrl,
} from "../lib/api";
import { APP_URL } from "../lib/config";
import type { Message } from "../lib/messages";
import { getAccessToken, supabase } from "../lib/supabase";
import { RecentSessions, SearchView, TasksView, UsageMeter } from "./cockpit";

type Capture =
  | { phase: "idle" }
  | { phase: "recording"; elapsed: number; paused: boolean; sessionId?: string }
  | { phase: "processing" }
  | { phase: "done"; sessionId: string; ready: boolean }
  | { phase: "error"; message: string; recoverable: boolean };

type Tab = "record" | "tasks" | "search";

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function MicLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

function MicGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

const WAVE_WEIGHTS = [0.45, 0.75, 1, 0.7, 1, 0.75, 0.45];
function Wave({ level, paused }: { level: number; paused: boolean }) {
  return (
    <div className={paused ? "wave paused" : "wave"} aria-hidden>
      {WAVE_WEIGHTS.map((w, i) => (
        <span key={i} style={{ height: paused ? 8 : Math.max(4, Math.round(4 + level * w * 24)) }} />
      ))}
    </div>
  );
}

function LivePreview({ sessionId }: { sessionId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      const token = await getAccessToken();
      if (!token) return;
      const d = await getSessionDetail(token, sessionId);
      if (!stop && d) setLines(d.transcript.slice(-3).map((s) => s.text).filter(Boolean));
    };
    void tick();
    const iv = setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [sessionId]);

  if (lines.length === 0) return null;
  return (
    <div className="preview">
      <span className="preview-label">Live transcript</span>
      {lines.map((l, i) => (
        <p key={i} className="preview-line">{l}</p>
      ))}
    </div>
  );
}

export function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("record");
  const [capture, setCapture] = useState<Capture>({ phase: "idle" });
  const [level, setLevel] = useState(0);
  const [progress, setProgress] = useState<{ transcribedMs: number; dropped: number }>({ transcribedMs: 0, dropped: 0 });
  const [marks, setMarks] = useState(0);
  const [markFlash, setMarkFlash] = useState<string | null>(null);
  const [recents, setRecents] = useState<SessionSummary[]>([]);
  const [recentsLoaded, setRecentsLoaded] = useState(false);
  const [usageReload, setUsageReload] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [onboard, setOnboard] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0); // epoch of the current running segment (0 while paused)
  const accumRef = useRef(0); // ms before the current segment
  const liveIdRef = useRef<string | null>(null); // live session id while recording

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    void chrome.storage.local.get("doppio_onboarded").then((v) => {
      if (!v.doppio_onboarded) setOnboard(true);
    });
  }, []);
  const dismissOnboard = useCallback(() => {
    setOnboard(false);
    void chrome.storage.local.set({ doppio_onboarded: true });
  }, []);

  const refreshRecents = useCallback(async () => {
    const token = await getAccessToken();
    if (token) {
      setRecents(await listSessions(token));
      setRecentsLoaded(true);
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const render = useCallback((paused: boolean) => {
    const ms = accumRef.current + (paused || !startRef.current ? 0 : Date.now() - startRef.current);
    setCapture({ phase: "recording", elapsed: Math.floor(ms / 1000), paused, sessionId: liveIdRef.current ?? undefined });
  }, []);

  const beginTimer = useCallback(
    (offsetMs: number, paused: boolean) => {
      stopTimer();
      accumRef.current = offsetMs;
      startRef.current = paused ? 0 : Date.now();
      render(paused);
      if (!paused) timerRef.current = setInterval(() => render(false), 500);
    },
    [stopTimer, render],
  );

  const pauseTimer = useCallback(() => {
    accumRef.current += startRef.current ? Date.now() - startRef.current : 0;
    startRef.current = 0;
    stopTimer();
    render(true);
  }, [stopTimer, render]);

  const resumeTimer = useCallback(() => {
    stopTimer(); // idempotent: safe to call optimistically and again on the broadcast
    startRef.current = Date.now();
    render(false);
    timerRef.current = setInterval(() => render(false), 500);
  }, [stopTimer, render]);

  // Rehydrate on (re)open: restore an in-progress (or paused) recording.
  useEffect(() => {
    if (!session) return;
    void refreshRecents();
    let cancelled = false;
    (async () => {
      try {
        const res = (await chrome.runtime.sendMessage({ type: "QUERY_STATE" } satisfies Message)) as Message | undefined;
        if (!cancelled && res?.type === "CAPTURE_STATE" && res.recording) {
          liveIdRef.current = res.sessionId ?? null;
          beginTimer(res.elapsedMs, res.paused);
        }
      } catch {
        /* no active recording → idle */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, refreshRecents, beginTimer]);

  useEffect(() => {
    const onMessage = (msg: Message) => {
      switch (msg.type) {
        case "CAPTURE_STARTED":
          liveIdRef.current = msg.sessionId ?? null;
          setLevel(0);
          setProgress({ transcribedMs: 0, dropped: 0 });
          setMarks(0);
          setTab("record");
          beginTimer(0, false);
          break;
        case "CAPTURE_PAUSED":
          pauseTimer();
          break;
        case "CAPTURE_RESUMED":
          resumeTimer();
          break;
        case "CAPTURE_LEVEL":
          setLevel(msg.level);
          break;
        case "CAPTURE_PROGRESS":
          setProgress({ transcribedMs: msg.transcribedMs, dropped: msg.dropped });
          break;
        case "CAPTURE_DISCARDED":
          liveIdRef.current = null;
          setLevel(0);
          stopTimer();
          setCapture({ phase: "idle" });
          break;
        case "CAPTURE_STOPPED":
          liveIdRef.current = null;
          setLevel(0);
          stopTimer();
          setCapture({ phase: "processing" });
          break;
        case "CAPTURE_UPLOADED":
          liveIdRef.current = null;
          setLevel(0);
          stopTimer();
          void chrome.tabs.create({ url: sessionUrl(msg.sessionId), active: true });
          setCapture({ phase: "done", sessionId: msg.sessionId, ready: false });
          setUsageReload((n) => n + 1);
          void refreshRecents();
          void pollReady(msg.sessionId);
          break;
        case "CAPTURE_ERROR":
          liveIdRef.current = null;
          setLevel(0);
          stopTimer();
          setCapture({ phase: "error", message: msg.message, recoverable: Boolean(msg.recoverable) });
          break;
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshRecents, beginTimer, pauseTimer, resumeTimer, stopTimer]);

  async function pollReady(sessionId: string) {
    const token = await getAccessToken();
    if (!token) return;
    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const status = await getSessionStatus(token, sessionId);
      if (status === "READY" || status === "FAILED") {
        setCapture((c) => (c.phase === "done" && c.sessionId === sessionId ? { ...c, ready: status === "READY" } : c));
        void refreshRecents();
        return;
      }
    }
  }

  function send(message: Message) {
    void chrome.runtime.sendMessage(message).catch(() => {});
  }

  async function stopCapture() {
    setCapture({ phase: "processing" });
    send({ type: "STOP_CAPTURE", token: (await getAccessToken()) ?? "" });
  }
  function discardCapture() {
    stopTimer();
    setLevel(0);
    setCapture({ phase: "idle" });
    send({ type: "OFFSCREEN_DISCARD" });
  }
  async function markMoment() {
    const id = liveIdRef.current;
    if (!id) return;
    const token = await getAccessToken();
    if (!token) return;
    const at = accumRef.current + (startRef.current ? Date.now() - startRef.current : 0);
    const ok = await addNote(token, id, "★ Marked moment", at);
    if (ok) {
      setMarks((m) => m + 1);
      setMarkFlash(`Marked at ${fmt(Math.floor(at / 1000))}`);
      setTimeout(() => setMarkFlash(null), 2500);
    }
  }

  if (authLoading) {
    return (
      <div className="app">
        <Topbar />
        <div className="wrap" style={{ alignItems: "center", paddingTop: 40 }}>
          <span className="spinner" />
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (!session) return <SignIn />;

  return (
    <div className="app">
      <Topbar email={session.user.email ?? undefined} onSignOut={() => void supabase.auth.signOut()} />
      {!online && <div className="banner">You're offline — changes will sync when you reconnect.</div>}

      <nav className="tabs">
        {(["record", "tasks", "search"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "record" ? "Record" : t === "tasks" ? "Tasks" : "Search"}
          </button>
        ))}
      </nav>

      <div className="wrap">
        {tab === "record" && (
          <>
            {onboard && capture.phase === "idle" && <OnboardCard onDismiss={dismissOnboard} />}
            <UsageMeter reloadSignal={usageReload} />
            <CaptureCard
              capture={capture}
              level={level}
              progress={progress}
              marks={marks}
              markFlash={markFlash}
              onStop={() => void stopCapture()}
              onPause={() => {
                pauseTimer();
                send({ type: "OFFSCREEN_PAUSE" });
              }}
              onResume={() => {
                resumeTimer();
                send({ type: "OFFSCREEN_RESUME" });
              }}
              onDiscard={discardCapture}
              onMark={() => void markMoment()}
              onReset={() => setCapture({ phase: "idle" })}
            />
            <RecentSessions
              sessions={recents}
              loaded={recentsLoaded}
              onRefresh={() => void refreshRecents()}
              onChanged={() => void refreshRecents()}
            />
          </>
        )}
        {tab === "tasks" && <TasksView />}
        {tab === "search" && <SearchView />}
      </div>
    </div>
  );
}

function OnboardCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="card onboard">
      <div className="row spread" style={{ width: "100%" }}>
        <span className="card-title">Welcome to Doppio 👋</span>
        <button className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      </div>
      <ol className="onboard-steps">
        <li>Open a tab that's playing audio — a meeting, call, or video.</li>
        <li>
          Click the <strong>Doppio icon</strong> in your toolbar to start recording.
        </li>
        <li>The transcript fills in live; hit Stop for the summary &amp; action items.</li>
      </ol>
      <p className="muted" style={{ margin: 0 }}>
        Tip: set a stop-from-anywhere shortcut at <code>chrome://extensions/shortcuts</code>.
      </p>
    </div>
  );
}

function Topbar({ email, onSignOut }: { email?: string; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <div className="row spread">
        <div className="brand-row">
          <span className="logo">
            <MicLogo />
          </span>
          <span className="brand">Doppio</span>
        </div>
        {onSignOut && (
          <div className="menu-wrap">
            <button className="icon-btn light" onClick={() => setOpen((o) => !o)} aria-label="Settings" title="Settings">
              ⚙
            </button>
            {open && (
              <>
                <div className="menu-backdrop" onClick={() => setOpen(false)} />
                <div className="menu menu-right">
                  {email && <div className="menu-email">{email}</div>}
                  <a className="menu-item" href={`${APP_URL}/sessions`} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                    Open Doppio ↗
                  </a>
                  <button className="menu-item" onClick={() => { setOpen(false); onSignOut(); }}>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function CaptureCard({
  capture,
  level,
  progress,
  marks,
  markFlash,
  onStop,
  onPause,
  onResume,
  onDiscard,
  onMark,
  onReset,
}: {
  capture: Capture;
  level: number;
  progress: { transcribedMs: number; dropped: number };
  marks: number;
  markFlash: string | null;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onMark: () => void;
  onReset: () => void;
}) {
  if (capture.phase === "recording") {
    return (
      <div className="card">
        <span className={capture.paused ? "status-pill paused" : "status-pill"}>
          <span className={capture.paused ? "dot dot-paused" : "dot"} />
          {capture.paused ? "Paused" : "Recording this tab"}
        </span>
        <Wave level={level} paused={capture.paused} />
        <div className="timer">{fmt(capture.elapsed)}</div>
        <button className="btn-rec btn-block" onClick={onStop}>
          Stop &amp; transcribe
        </button>
        <div className="row" style={{ gap: 8, width: "100%" }}>
          <button className="btn-outline" style={{ flex: 1 }} onClick={capture.paused ? onResume : onPause}>
            {capture.paused ? "Resume" : "Pause"}
          </button>
          <button className="btn-outline btn-danger-outline" style={{ flex: 1 }} onClick={onDiscard}>
            Discard
          </button>
        </div>
        <button className="btn-mark btn-block" onClick={onMark} disabled={!capture.sessionId}>
          ★ Mark this moment{marks > 0 ? ` (${marks})` : ""}
        </button>
        {markFlash && <p className="hint-ok">{markFlash}</p>}
        <p className="muted progress-line">
          {progress.transcribedMs > 0 ? `${fmt(Math.floor(progress.transcribedMs / 1000))} transcribed` : "Transcribing live…"}
          {progress.dropped > 0 && <span className="warn"> · ⚠ {progress.dropped} chunk{progress.dropped > 1 ? "s" : ""} dropped</span>}
        </p>
        {capture.sessionId && <LivePreview sessionId={capture.sessionId} />}
        {capture.sessionId && (
          <a className="link" href={sessionUrl(capture.sessionId)} target="_blank" rel="noreferrer" title="Open the full live transcript">
            Open full transcript ↗
          </a>
        )}
      </div>
    );
  }
  if (capture.phase === "processing") {
    return (
      <div className="card">
        <span className="spinner" />
        <p className="muted">Finishing the last bit &amp; summarizing…</p>
      </div>
    );
  }
  if (capture.phase === "done") {
    return (
      <div className="card">
        <p className="card-title">{capture.ready ? "Transcript ready ✓" : "Processing…"}</p>
        <a
          className="btn-primary btn-block"
          href={sessionUrl(capture.sessionId)}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", textAlign: "center" }}
        >
          Open in Doppio
        </a>
        <button className="link" onClick={onReset}>
          Done
        </button>
      </div>
    );
  }
  if (capture.phase === "error") {
    return (
      <div className="card">
        <div className="error">{capture.message}</div>
        <button className="btn-primary btn-block" onClick={onReset}>
          OK
        </button>
      </div>
    );
  }
  return (
    <div className="card card-hero">
      <div className="mic-tile">
        <MicGlyph />
      </div>
      <p className="card-title">Record the current tab</p>
      <p className="muted">
        Click the <strong>Doppio icon</strong> in your Chrome toolbar on the tab you want to record. The transcript fills in
        live as you record; come back here to Pause, Stop, Mark moments, or Discard.
      </p>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
  }

  return (
    <div className="app">
      <Topbar />
      <div className="screen">
        <div>
          <p className="card-title" style={{ marginBottom: 4 }}>
            Welcome back
          </p>
          <p className="muted" style={{ margin: 0 }}>
            Sign in to capture tabs into your workspace.
          </p>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn-primary btn-block" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        {error && <div className="error">{error}</div>}
        <p className="muted">
          No account?{" "}
          <a className="link" href={`${APP_URL}/login`} target="_blank" rel="noreferrer">
            Create one in the portal
          </a>
        </p>
      </div>
    </div>
  );
}
