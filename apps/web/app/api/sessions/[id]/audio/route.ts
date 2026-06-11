import { prisma } from "@doppio/db";
import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { createSignedPlaybackUrl } from "@/lib/storage";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Short-lived playback URL; 404 if private mode discarded the audio (INIT-18). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const { id } = await ctx.params;
  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { audioKey: true },
  });
  if (!session) return apiError("NOT_FOUND", "Session not found", 404);
  if (!session.audioKey) return apiError("NO_AUDIO", "Audio not retained for this session", 404);

  const url = await createSignedPlaybackUrl(session.audioKey);
  return NextResponse.json({ url });
}
