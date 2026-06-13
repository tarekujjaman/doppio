import { prisma } from "@doppio/db";

export type SessionExportData = NonNullable<Awaited<ReturnType<typeof loadSessionExportData>>>;

/** Everything an export (PDF/DOCX) or share page renders, ownership-scoped. */
export async function loadSessionExportData(sessionId: string, userId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, userId },
    include: {
      transcript: { orderBy: { idx: "asc" } },
      summary: true,
      actionItems: true,
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
}

export function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
}
