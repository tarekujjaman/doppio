import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PKCE callback: exchanges ?code= for a session.
 * Failure modes are classified so /login can explain what actually happened:
 *  - otp_expired: link expired or already used (email scanners often consume links)
 *  - cross_device: link opened in a different browser than the one that requested it
 *  - auth_failed: anything else
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Supabase forwards verification failures as query params — surface them.
  const forwardedCode = searchParams.get("error_code");
  if (forwardedCode) {
    const reason = forwardedCode === "otp_expired" ? "otp_expired" : "auth_failed";
    return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    // PKCE verifier lives in the requesting browser's cookies; missing verifier
    // means the link was opened elsewhere (new browser, in-app webview, etc.).
    const crossDevice =
      /code verifier/i.test(error.message) || /flow state/i.test(error.message);
    return NextResponse.redirect(
      new URL(`/login?error=${crossDevice ? "cross_device" : "auth_failed"}`, origin),
    );
  }

  return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
}
