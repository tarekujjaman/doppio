import { prisma } from "@doppio/db";
import { apiError } from "@/lib/api";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/** MVP-33: full JSON dump of the user's data (data portability). */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const [profile, sessions, payments, usage] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.session.findMany({
      where: { userId: user.id },
      include: {
        transcript: { orderBy: { idx: "asc" } },
        summary: true,
        actionItems: true,
        notes: true,
        shares: { select: { scope: true, expiresAt: true, revoked: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    prisma.usageLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  const dump = {
    exportedAt: new Date().toISOString(),
    profile,
    sessions,
    payments,
    usage,
  };

  return new Response(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="doppio-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
