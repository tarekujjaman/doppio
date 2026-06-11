import { NextResponse } from "next/server";

/** Smoke check + Supabase keep-alive cron target (M9). */
export function GET() {
  return NextResponse.json({ ok: true, service: "doppio-web" });
}
