import { APP_URL } from "./config";

export interface SessionSummary {
  id: string;
  title: string;
  status: string;
  createdAt: string;
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

/** Recent sessions for the panel list (MVP-20 subset: backend is source of truth). */
export async function listSessions(token: string): Promise<SessionSummary[]> {
  const res = await authed(token, "/api/sessions");
  if (!res.ok) return [];
  const body = (await res.json()) as { sessions: SessionSummary[] };
  return body.sessions ?? [];
}

export async function getSessionStatus(token: string, id: string): Promise<string | null> {
  const res = await authed(token, `/api/sessions/${id}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { session: { status: string } };
  return body.session?.status ?? null;
}

export function sessionUrl(id: string): string {
  return `${APP_URL}/sessions/${id}`;
}
