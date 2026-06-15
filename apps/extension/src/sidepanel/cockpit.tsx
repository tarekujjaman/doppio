import { useCallback, useEffect, useState } from "react";
import {
  type BillingUsage,
  createShareUrl,
  deleteSession,
  getBilling,
  getSessionDetail,
  listOpenTasks,
  renameSession,
  searchSessions,
  type SearchHit,
  type SearchResult,
  type SessionDetail,
  type SessionSummary,
  sessionUrl,
  setTaskDone,
  type TaskItem,
} from "../lib/api";
import { getAccessToken } from "../lib/supabase";
import { APP_URL } from "../lib/config";
import { usePopover } from "./usePopover";

// ── shared helpers ───────────────────────────────────────────────────────────

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtClock(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "";
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Render a search snippet's [[m]]…[[/m]] markers as <mark>. */
function highlight(snippet: string) {
  const parts = snippet.split(/(\[\[m\]\]|\[\[\/m\]\])/);
  const out: React.ReactNode[] = [];
  let on = false;
  let k = 0;
  for (const p of parts) {
    if (p === "[[m]]") { on = true; continue; }
    if (p === "[[/m]]") { on = false; continue; }
    if (!p) continue;
    out.push(on ? <mark key={k++}>{p}</mark> : <span key={k++}>{p}</span>);
  }
  return out;
}

function chipClass(status: string): string {
  return status === "READY" ? "chip-ready" : status === "FAILED" ? "chip-fail" : "chip-proc";
}
function chipLabel(status: string): string {
  return status === "READY" ? "Ready" : status === "FAILED" ? "Failed" : "Processing";
}

// ── Usage meter ──────────────────────────────────────────────────────────────

export function UsageMeter({ reloadSignal }: { reloadSignal: number }) {
  const [usage, setUsage] = useState<BillingUsage | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const u = await getBilling(token);
      if (!cancelled) setUsage(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadSignal]);

  if (!usage) return null;
  const { transcribeMinutesThisMonth: used, transcribeMinutesCap: cap } = usage;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const near = pct >= 80;
  const atCap = cap > 0 && used >= cap;
  return (
    <div className="meter" title={`${usage.plan} plan`}>
      <div className="row spread">
        <span className="meter-label">Transcription this month</span>
        <span className={near ? "meter-val warn" : "meter-val"}>
          {used} / {cap} min
        </span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: near ? "var(--accent)" : "var(--brand)" }} />
      </div>
      {atCap && (
        <a className="link" href={`${APP_URL}/billing`} target="_blank" rel="noreferrer">
          Monthly limit reached — ↑ Upgrade plan
        </a>
      )}
    </div>
  );
}

// ── Recent sessions (expandable peek + row actions) ──────────────────────────

export function RecentSessions({
  sessions,
  loaded,
  onRefresh,
  onChanged,
}: {
  sessions: SessionSummary[];
  loaded: boolean;
  onRefresh: () => void;
  onChanged: () => void;
}) {
  // Supabase free tier sleeps after idle — surface a "waking up" hint on a slow first load.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div>
      <div className="row spread" style={{ marginBottom: 10 }}>
        <span className="section-title">Recent sessions</span>
        <button className="link" onClick={onRefresh}>
          Refresh
        </button>
      </div>
      {!loaded ? (
        <div className="empty">
          <span className="spinner" aria-hidden />
          <p className="muted">{slow ? "Waking up the server…" : "Loading sessions…"}</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty">
          <p style={{ fontWeight: 600, margin: 0 }}>No sessions yet</p>
          <p className="muted" style={{ margin: 0 }}>Record a tab to get started.</p>
        </div>
      ) : (
        <div className="session-list">
          {sessions.slice(0, 10).map((s) => (
            <SessionRow key={s.id} session={s} onChanged={onChanged} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onChanged }: { session: SessionSummary; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { open: menu, setOpen: setMenu, triggerRef, menuRef } = usePopover();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(session.title);
  const [draft, setDraft] = useState(session.title);
  const [confirmDel, setConfirmDel] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !detail && session.status === "READY") {
      setLoadingDetail(true);
      const token = await getAccessToken();
      if (token) setDetail(await getSessionDetail(token, session.id));
      setLoadingDetail(false);
    }
  }

  async function copyLink() {
    setMenu(false);
    const token = await getAccessToken();
    if (!token) return;
    const url = await createShareUrl(token, session.id, "summary");
    if (!url) {
      setCopied("fail");
      setTimeout(() => setCopied(null), 2200);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(null), 2200);
  }

  async function saveRename() {
    const name = draft.trim();
    setRenaming(false);
    if (!name || name === title) return;
    setTitle(name);
    const token = await getAccessToken();
    if (token) {
      await renameSession(token, session.id, name);
      onChanged();
    }
  }

  async function doDelete() {
    const token = await getAccessToken();
    if (token) {
      await deleteSession(token, session.id);
      onChanged();
    }
  }

  return (
    <div className="session-card">
      <div className="session-head">
        <button className="session-main as-button" onClick={toggleOpen} title="Show summary">
          <span className="session-title">{title}</span>
          <span className="session-time">
            {timeAgo(session.createdAt)} · {chipLabel(session.status)}
          </span>
        </button>
        <span className={`chip ${chipClass(session.status)}`}>{chipLabel(session.status)}</span>
        <div className="menu-wrap">
          <button
            ref={triggerRef}
            className="icon-btn"
            onClick={() => setMenu((m) => !m)}
            aria-label="Session actions"
            aria-haspopup="menu"
            aria-expanded={menu}
          >
            ⋯
          </button>
          {menu && (
            <>
              <div className="menu-backdrop" onClick={() => setMenu(false)} />
              <div className="menu menu-right" ref={menuRef} role="menu">
                <a className="menu-item" role="menuitem" href={sessionUrl(session.id)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
                  <span className="menu-ico">↗</span> Open in Doppio
                </a>
                <button className="menu-item" role="menuitem" onClick={copyLink}>
                  <span className="menu-ico">🔗</span> Copy share link
                </button>
                <button className="menu-item" role="menuitem" onClick={() => { setMenu(false); setDraft(title); setRenaming(true); }}>
                  <span className="menu-ico">✎</span> Rename
                </button>
                <div className="menu-sep" />
                {confirmDel ? (
                  <button className="menu-item danger" role="menuitem" onClick={doDelete}>
                    <span className="menu-ico">🗑</span> Confirm delete?
                  </button>
                ) : (
                  <button className="menu-item danger" role="menuitem" onClick={() => setConfirmDel(true)}>
                    <span className="menu-ico">🗑</span> Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {copied === "ok" && <p className="hint-ok">Link copied ✓</p>}
      {copied === "fail" && <p className="hint-err">Couldn't copy link — try again</p>}

      {renaming && (
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); if (e.key === "Escape") setRenaming(false); }}
          />
          <button className="btn-primary" style={{ padding: "8px 12px" }} onClick={() => void saveRename()}>Save</button>
        </div>
      )}

      {open && (
        <div className="peek">
          {session.status !== "READY" ? (
            <p className="muted" style={{ margin: 0 }}>Summary appears once processing finishes.</p>
          ) : loadingDetail ? (
            <div className="row" style={{ gap: 8 }}><span className="spinner" aria-hidden /> <span className="muted">Loading…</span></div>
          ) : detail?.summary ? (
            <>
              <p className="peek-text">{detail.summary.overview}</p>
              {detail.actionItems.length > 0 && (
                <ul className="peek-tasks">
                  {detail.actionItems.slice(0, 4).map((a) => (
                    <li key={a.id} className={a.done ? "done" : ""}>{a.text}</li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No summary yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tasks tab ────────────────────────────────────────────────────────────────

export function TasksView() {
  const [tasks, setTasks] = useState<TaskItem[] | null>(null);

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (token) setTasks(await listOpenTasks(token));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(id: string) {
    setTasks((cur) => (cur ? cur.filter((t) => t.id !== id) : cur)); // optimistic: drops from the open list
    const token = await getAccessToken();
    if (token) await setTaskDone(token, id, true);
  }

  if (tasks === null) {
    return <div className="empty"><span className="spinner" aria-hidden /><p className="muted">Loading tasks…</p></div>;
  }
  if (tasks.length === 0) {
    return (
      <div className="empty">
        <p style={{ fontWeight: 600, margin: 0 }}>No open tasks</p>
        <p className="muted" style={{ margin: 0 }}>Action items from your sessions show up here.</p>
      </div>
    );
  }
  return (
    <div className="task-list">
      <div className="row spread" style={{ marginBottom: 4 }}>
        <span className="section-title">Open tasks</span>
        <button className="link" onClick={() => void load()}>Refresh</button>
      </div>
      {tasks.map((t) => (
        <div key={t.id} className="task">
          <button className="task-check" onClick={() => void complete(t.id)} aria-label="Mark done" title="Mark done" />
          <div className="task-body">
            <span className="task-text">{t.text}</span>
            <a className="task-src" href={sessionUrl(t.session.id)} target="_blank" rel="noreferrer">
              {t.session.title}
              {t.dueHint ? ` · ${t.dueHint}` : ""}
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Search tab ───────────────────────────────────────────────────────────────

export function SearchView() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResult(null);
      return;
    }
    setBusy(true);
    const handle = setTimeout(async () => {
      const token = await getAccessToken();
      setResult(token ? await searchSessions(token, query) : { ok: false });
      setBusy(false);
    }, 350);
    return () => clearTimeout(handle);
  }, [q]);

  const hits = result?.ok ? result.hits : [];
  return (
    <div className="search">
      <input
        type="search"
        placeholder="Search your transcripts & notes…"
        value={q}
        autoFocus
        onChange={(e) => setQ(e.target.value)}
      />
      {busy && <div className="row" style={{ gap: 8 }}><span className="spinner" aria-hidden /> <span className="muted">Searching…</span></div>}
      {!busy && result && !result.ok && (
        <div className="empty">
          <p style={{ fontWeight: 600, margin: 0 }}>Search failed</p>
          <p className="muted" style={{ margin: 0 }}>Couldn't reach the server — try again.</p>
        </div>
      )}
      {!busy && result?.ok && hits.length === 0 && (
        <p className="muted" style={{ textAlign: "center" }}>No matches for “{q.trim()}”.</p>
      )}
      {!busy && hits.length > 0 && (
        <div className="hit-list">
          {hits.map((h, i) => (
            <a
              key={i}
              className="hit"
              href={h.startMs !== null ? `${sessionUrl(h.sessionId)}?t=${h.startMs}` : sessionUrl(h.sessionId)}
              target="_blank"
              rel="noreferrer"
            >
              <span className="hit-head">
                <span className="hit-title">{h.sessionTitle}</span>
                <span className="hit-kind">{h.kind}{h.startMs !== null ? ` · ${fmtClock(h.startMs)}` : ""}</span>
              </span>
              <span className="hit-snippet">{highlight(h.snippet)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
