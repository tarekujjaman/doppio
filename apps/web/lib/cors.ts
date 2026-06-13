import { NextResponse, type NextRequest } from "next/server";

// Chrome extension IDs are 32 chars in a–p.
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

// Once the extension has a stable ID (published, or via a manifest key), set
// DOPPIO_EXTENSION_IDS (comma-separated) to lock CORS to it. Unset → any
// extension origin is allowed (needed for unpacked dev, where the ID is random).
// Either way requests still require a valid Bearer token — CORS is browser-only
// defense-in-depth, not the auth boundary.
const PINNED = (process.env.DOPPIO_EXTENSION_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((id) => `chrome-extension://${id}`);

/** Returns the request's origin if it's an allowed Chrome-extension origin. */
export function extensionOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (PINNED.length > 0) return PINNED.includes(origin) ? origin : null;
  return EXTENSION_ORIGIN.test(origin) ? origin : null;
}

/** Adds permissive CORS headers (Bearer auth, so no credentials/cookies). */
export function withCors(response: NextResponse, origin: string): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.append("Vary", "Origin");
  return response;
}
