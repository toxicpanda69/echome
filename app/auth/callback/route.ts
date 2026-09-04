import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Where a social provider returns to. Exchanges the authorisation code for a
 * session, then sends the user where they were originally headed.
 *
 * A provider can also come back with an error — the person hit "cancel" on the
 * consent screen, or the app is misconfigured. Both land on /login with a
 * message rather than a blank page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  if (searchParams.get("error")) {
    // The provider's own error text is not shown: it is written for developers
    // and sometimes names the app's configuration.
    redirect("/login?error=oauth");
  }

  const code = searchParams.get("code");
  if (!code) redirect("/login?error=oauth");

  const next = searchParams.get("next");
  const destination = next?.startsWith("/") ? next : "/welcome";

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  redirect(error ? "/login?error=oauth" : destination);
}
