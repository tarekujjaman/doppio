import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Email magic-link landing (token_hash flow): verifies and starts the session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next") ?? "/dashboard";

  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    const expired = /expired|invalid/i.test(error.message);
    return NextResponse.redirect(
      new URL(`/login?error=${expired ? "otp_expired" : "auth_failed"}`, origin),
    );
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", origin));
}
