import { NextResponse, type NextRequest } from "next/server";

// Chrome extension IDs are 32 chars in a–p. Allowing any extension origin (not a
// fixed id) keeps dev + prod ids working; requests still need a valid Bearer
// token, so this only controls which origins may READ responses.
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;

/** Returns the request's origin if it's an allowed Chrome-extension origin. */
export function extensionOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  return origin && EXTENSION_ORIGIN.test(origin) ? origin : null;
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
