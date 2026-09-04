import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for emailed links: signup confirmation and password reset.
 * Exchanges the one-time token for a session, then sends the user on.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");
  const destination = next?.startsWith("/") ? next : "/welcome";

  if (!tokenHash || !type) redirect("/login?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  redirect(error ? "/login?error=link" : destination);
}
