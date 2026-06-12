import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Smoke check + Supabase keep-alive cron target. Pings the DB so production
 * Prisma failures surface here with a real message instead of opaque 500s.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, service: "doppio-web", db: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        service: "doppio-web",
        db: false,
        error: err instanceof Error ? `${err.name}: ${err.message.slice(0, 500)}` : String(err),
      },
      { status: 500 },
    );
  }
}
