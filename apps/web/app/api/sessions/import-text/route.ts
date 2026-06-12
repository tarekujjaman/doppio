import { detectLanguage } from "@doppio/core";
import { prisma } from "@doppio/db";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { indexSession } from "@/lib/pipeline/index-session";
import { summarizeSession } from "@/lib/pipeline/summarize-session";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  text: z.string().min(1).max(500_000),
});

/** MVP-37: paste/upload text becomes a READY session with one synthetic segment. */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("INVALID_BODY", parsed.error.message, 400);
  const { title, text } = parsed.data;

  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? null },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      title: title ?? text.slice(0, 60),
      source: "TEXT_IMPORT",
      status: "SUMMARIZING",
      language: detectLanguage(text),
      transcript: { create: [{ idx: 0, startMs: 0, endMs: 0, text }] },
    },
  });

  after(async () => {
    try {
      await summarizeSession(session.id, { setTitleAndTags: !title });
    } catch (err) {
      console.error(`summarize failed for text import ${session.id}:`, err);
    }
    try {
      await indexSession(session.id);
    } catch (err) {
      console.error(`indexing failed for text import ${session.id}:`, err);
    }
    await prisma.session.update({ where: { id: session.id }, data: { status: "READY" } });
  });

  return NextResponse.json({ sessionId: session.id }, { status: 201 });
}
