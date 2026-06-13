import { NextResponse, type NextRequest } from "next/server";
import { extensionOrigin, withCors } from "@/lib/cors";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api");
  const origin = extensionOrigin(request);

  // CORS for the Chrome extension (cross-origin, Bearer-authenticated).
  if (isApi && origin) {
    if (request.method === "OPTIONS") {
      return withCors(new NextResponse(null, { status: 204 }), origin);
    }
    const res = await updateSession(request);
    return withCors(res, origin);
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets, images, and public share pages.
    "/((?!_next/static|_next/image|favicon.ico|share/|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
