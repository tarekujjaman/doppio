import { APP_URL } from "./config";

export interface SessionSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface BillingUsage {
  plan: string;
  transcribeMinutesThisMonth: number;
  transcribeMinutesCap: number;
  askCallsToday: number;
  askCallsCap: number;
}

export interface TaskItem {
  id: string;
  text: string;
  owner: string | null;
  dueHint: string | null;
  done: boolean;
  session: { id: string; title: string };
}

export interface SearchHit {
  sessionId: string;
  sessionTitle: string;
  kind: "segment" | "note" | "title";
  startMs: number | null;
  /** Snippet with [[m]]…[[/m]] highlight markers. */
  snippet: string;
}

export interface SessionDetail {
  id: string;
  title: string;
  status: string;
  summary: { overview: string; decisions: string | null; nextSteps: string | null } | null;
  actionItems: { id: string; text: string; done: boolean; owner: string | null; dueHint: string | null }[];
  notes: { id: string; text: string; anchorMs: number | null }[];
  transcript: { idx: number; startMs: number; endMs: number; text: string; speaker: string | null }[];
}

async function authed(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function authedJson<T>(token: string, path: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await authed(token, path, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Recent sessions for the panel list (MVP-20 subset: backend is source of truth). */
export async function listSessions(token: string): Promise<SessionSummary[]> {
  const body = await authedJson<{ sessions: SessionSummary[] }>(token, "/api/sessions");
  return body?.sessions ?? [];
}

export async function getSessionStatus(token: string, id: string): Promise<string | null> {
  const body = await authedJson<{ session: { status: string } }>(token, `/api/sessions/${id}`);
  return body?.session?.status ?? null;
}

export async function getBilling(token: string): Promise<BillingUsage | null> {
  const body = await authedJson<{ plan: string; usage: Omit<BillingUsage, "plan"> }>(token, "/api/billing");
  return body ? { plan: body.plan, ...body.usage } : null;
}

export async function listOpenTasks(token: string): Promise<TaskItem[]> {
  const body = await authedJson<{ items: TaskItem[] }>(token, "/api/action-items?done=false");
  return body?.items ?? [];
}

export async function setTaskDone(token: string, id: string, done: boolean): Promise<boolean> {
  const res = await authed(token, `/api/action-items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export type SearchResult = { ok: true; hits: SearchHit[] } | { ok: false };

/** Distinguishes a failed request from zero results (so the UI can say which). */
export async function searchSessions(token: string, q: string): Promise<SearchResult> {
  try {
    const res = await authed(token, `/api/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { hits?: SearchHit[] };
    return { ok: true, hits: body.hits ?? [] };
  } catch {
    return { ok: false };
  }
}

export async function getSessionDetail(token: string, id: string): Promise<SessionDetail | null> {
  const body = await authedJson<{ session: SessionDetail }>(token, `/api/sessions/${id}`);
  return body?.session ?? null;
}

export async function renameSession(token: string, id: string, title: string): Promise<boolean> {
  const res = await authed(token, `/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function deleteSession(token: string, id: string): Promise<boolean> {
  const res = await authed(token, `/api/sessions/${id}`, { method: "DELETE" }).catch(() => null);
  return Boolean(res?.ok);
}

/** Create a share link and return the public URL (or null on failure). */
export async function createShareUrl(token: string, id: string, scope: "summary" | "full" = "summary"): Promise<string | null> {
  const body = await authedJson<{ link: { token: string } }>(token, `/api/sessions/${id}/share`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scope }),
  });
  return body?.link?.token ? `${APP_URL}/share/${body.link.token}` : null;
}

/** Add a (optionally timestamp-anchored) note — used by "mark moment" during recording. */
export async function addNote(token: string, id: string, text: string, anchorMs?: number): Promise<boolean> {
  const res = await authed(token, `/api/sessions/${id}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, anchorMs: anchorMs ?? null }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export function sessionUrl(id: string): string {
  return `${APP_URL}/sessions/${id}`;
}
