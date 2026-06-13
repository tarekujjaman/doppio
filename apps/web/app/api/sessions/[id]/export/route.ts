import { type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { loadSessionExportData } from "@/lib/export/data";
import { generateSessionDocx } from "@/lib/export/docx";
import { generateSessionPdf } from "@/lib/export/pdf";
import { getAuthUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeFilename(title: string, ext: string): string {
  const base = title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim().slice(0, 60) || "session";
  return `${base}.${ext}`;
}

/** MVP-24/34: export transcript + summary + actions + notes as PDF or DOCX. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in required", 401);

  const format = request.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "docx") {
    return apiError("INVALID_FORMAT", "format must be pdf or docx", 400);
  }

  const { id } = await ctx.params;
  const data = await loadSessionExportData(id, user.id);
  if (!data) return apiError("NOT_FOUND", "Session not found", 404);

  try {
    if (format === "pdf") {
      const bytes = await generateSessionPdf(data);
      return new Response(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename(data.title, "pdf"))}`,
        },
      });
    }

    const buffer = await generateSessionDocx(data);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename(data.title, "docx"))}`,
      },
    });
  } catch (err) {
    console.error(`export failed for session ${id}:`, err);
    return apiError(
      "EXPORT_FAILED",
      err instanceof Error ? err.message.slice(0, 300) : "Export failed",
      500,
    );
  }
}
