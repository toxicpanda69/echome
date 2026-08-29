import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth code exchange. Nothing calls this yet — it is the other half of the
 * Google seam in app/(auth)/actions.ts, in place so that enabling the provider
 * is a dashboard change and a button, not a code change.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) redirect("/login?error=oauth");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  redirect(error ? "/login?error=oauth" : "/chat");
}
