import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSessionStatus, listSessions, sessionUrl, type SessionSummary } from "../lib/api";
import { APP_URL } from "../lib/config";
import type { Message } from "../lib/messages";
import { getAccessToken, supabase } from "../lib/supabase";

type Capture =
  | { phase: "idle" }
  | { phase: "recording"; elapsed: number; paused: boolean }
  | { phase: "processing" }
  | { phase: "done"; sessionId: string; ready: boolean }
  | { phase: "error"; message: string; recoverable: boolean };

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [capture, setCapture] = useState<Capture>({ phase: "idle" });
  const [recents, setRecents] = useState<SessionSummary[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0); // epoch of the current running segment (0 while paused)
  const accumRef = useRef(0); // ms before the current segment

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshRecents = useCallback(async () => {
    const token = await getAccessToken();
    if (token) setRecents(await listSessions(token));
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const render = useCallback((paused: boolean) => {
    const ms = accumRef.current + (paused || !startRef.current ? 0 : Date.now() - startRef.current);
    setCapture({ phase: "recording", elapsed: Math.floor(ms / 1000), paused });
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
    startRef.current = Date.now();
    render(false);
    timerRef.current = setInterval(() => render(false), 500);
  }, [render]);

  // Rehydrate on (re)open: restore an in-progress (or paused) recording.
  useEffect(() => {
    if (!session) return;
    void refreshRecents();
    let cancelled = false;
    (async () => {
      try {
        const res = (await chrome.runtime.sendMessage({ type: "QUERY_STATE" } satisfies Message)) as
          | Message
          | undefined;
        if (!cancelled && res?.type === "CAPTURE_STATE" && res.recording) {
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
          beginTimer(0, false);
          break;
        case "CAPTURE_PAUSED":
          pauseTimer();
          break;
        case "CAPTURE_RESUMED":
          resumeTimer();
          break;
        case "CAPTURE_DISCARDED":
          stopTimer();
          setCapture({ phase: "idle" });
          break;
        case "CAPTURE_STOPPED":
          stopTimer();
          setCapture({ phase: "processing" });
          break;
        case "CAPTURE_UPLOADED":
          stopTimer();
          // Land on the session page immediately — it shows the transcript and
          // summary filling in live while processing finishes.
          void chrome.tabs.create({ url: sessionUrl(msg.sessionId), active: true });
          setCapture({ phase: "done", sessionId: msg.sessionId, ready: false });
          void refreshRecents();
          void pollReady(msg.sessionId);
          break;
        case "CAPTURE_ERROR":
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
        setCapture((c) =>
          c.phase === "done" && c.sessionId === sessionId ? { ...c, ready: status === "READY" } : c,
        );
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
  async function retryUpload() {
    setCapture({ phase: "processing" });
    send({ type: "RETRY_UPLOAD", token: (await getAccessToken()) ?? "" });
  }
  function discardCapture() {
    if (confirm("Discard this recording? It can't be recovered.")) send({ type: "OFFSCREEN_DISCARD" });
  }

  if (authLoading) {
    return (
      <div className="wrap">
        <div className="brand">Doppio</div>
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <SignIn />;

  return (
    <div className="wrap">
      <div className="row spread">
        <span className="brand">Doppio</span>
        <button className="btn-ghost" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
      <p className="muted" style={{ marginTop: -8 }}>
        {session.user.email}
      </p>

      <CaptureCard
        capture={capture}
        onStop={() => void stopCapture()}
        onPause={() => send({ type: "OFFSCREEN_PAUSE" })}
        onResume={() => send({ type: "OFFSCREEN_RESUME" })}
        onDiscard={discardCapture}
        onRetry={() => void retryUpload()}
        onDownload={() => send({ type: "DOWNLOAD_RECORDING" })}
        onReset={() => setCapture({ phase: "idle" })}
      />

      <div>
        <div className="row spread" style={{ marginBottom: 8 }}>
          <span className="section-title">Recent sessions</span>
          <button className="link" onClick={() => void refreshRecents()}>
            Refresh
          </button>
        </div>
        {recents.length === 0 ? (
          <p className="muted">Nothing yet — record a tab to get started.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recents.slice(0, 8).map((s) => (
              <a key={s.id} className="session" href={sessionUrl(s.id)} target="_blank" rel="noreferrer">
                <span className="session-title">{s.title}</span>
                <span
                  className={`chip ${
                    s.status === "READY" ? "chip-ready" : s.status === "FAILED" ? "chip-fail" : "chip-proc"
                  }`}
                >
                  {s.status === "READY" ? "Ready" : s.status === "FAILED" ? "Failed" : "Processing"}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CaptureCard({
  capture,
  onStop,
  onPause,
  onResume,
  onDiscard,
  onRetry,
  onDownload,
  onReset,
}: {
  capture: Capture;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  onDownload: () => void;
  onReset: () => void;
}) {
  if (capture.phase === "recording") {
    return (
      <div className="card">
        <div className="row">
          <span className={capture.paused ? "dot dot-paused" : "dot"} />
          <span className="muted">{capture.paused ? "Paused" : "Recording this tab"}</span>
        </div>
        <div className="timer">{fmt(capture.elapsed)}</div>
        <button className="btn-rec btn-block" onClick={onStop}>
          Stop &amp; transcribe
        </button>
        <div className="row" style={{ gap: 8, width: "100%" }}>
          {capture.paused ? (
            <button className="btn-outline" style={{ flex: 1 }} onClick={onResume}>
              Resume
            </button>
          ) : (
            <button className="btn-outline" style={{ flex: 1 }} onClick={onPause}>
              Pause
            </button>
          )}
          <button className="btn-outline btn-danger-outline" style={{ flex: 1 }} onClick={onDiscard}>
            Discard
          </button>
        </div>
        <p className="muted">Up to ~25&nbsp;min per recording.</p>
      </div>
    );
  }
  if (capture.phase === "processing") {
    return (
      <div className="card">
        <p className="muted">Working…</p>
      </div>
    );
  }
  if (capture.phase === "done") {
    return (
      <div className="card">
        <p style={{ fontWeight: 600 }}>{capture.ready ? "Transcript ready ✓" : "Processing…"}</p>
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
        {capture.recoverable ? (
          <>
            <button className="btn-primary btn-block" onClick={onRetry}>
              Retry upload
            </button>
            <div className="row" style={{ gap: 12 }}>
              <button className="link" onClick={onDownload}>
                Download recording
              </button>
              <button className="link" onClick={onReset}>
                Discard
              </button>
            </div>
          </>
        ) : (
          <button className="btn-primary btn-block" onClick={onReset}>
            OK
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="card">
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "#eef5f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        🎙️
      </div>
      <p style={{ fontWeight: 600 }}>Record the current tab</p>
      <p className="muted">
        Click the <strong>Doppio icon</strong> in your Chrome toolbar on the tab you want to record.
        Recording starts immediately; come back here to Pause, Stop, or Discard.
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
    <div className="wrap">
      <div className="brand">Doppio</div>
      <p className="muted" style={{ marginTop: -8 }}>
        Sign in to capture tabs into your workspace.
      </p>
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
  );
}
