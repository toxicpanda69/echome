import { NextResponse, type NextRequest } from "next/server";

import { LOCAL_MODE } from "@/lib/local/mode";
import { updateSession } from "@/lib/supabase/session";
import { localGate } from "@/lib/local/gate";

/**
 * Next 16 renamed the middleware convention to `proxy`. The behaviour is
 * unchanged: refresh the session on every request and gate the app.
 *
 * In local mode there is no Supabase session to refresh, so the whole Supabase
 * path is skipped rather than called with credentials that do not exist.
 */
export default async function proxy(request: NextRequest) {
  if (LOCAL_MODE) return localGate(request);
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
