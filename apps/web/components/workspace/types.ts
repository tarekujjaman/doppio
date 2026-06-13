/** JSON-safe session DTO shared by the workspace page (SSR) and its polling. */
export interface WorkspaceSegment {
  id: string;
  idx: number;
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
}

export interface WorkspaceNote {
  id: string;
  text: string;
  anchorMs: number | null;
  createdAt: string;
}

export interface WorkspaceActionItem {
  id: string;
  text: string;
  owner: string | null;
  dueHint: string | null;
  done: boolean;
}

export interface WorkspaceSummary {
  overview: string;
  decisions: string | null;
  nextSteps: string | null;
  language: string;
}

export interface WorkspaceSession {
  id: string;
  title: string;
  status: string;
  language: string | null;
  durationSec: number | null;
  privateMode: boolean;
  hasAudio: boolean;
  tags: string[];
  createdAt: string;
  transcript: WorkspaceSegment[];
  summary: WorkspaceSummary | null;
  actionItems: WorkspaceActionItem[];
  notes: WorkspaceNote[];
}

export function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
