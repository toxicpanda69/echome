import { NextResponse, type NextRequest } from "next/server";

import { localUserFromCookieValue } from "@/lib/local/auth";

/**
 * The local-mode stand-in for Supabase session refresh.
 *
 * There is no token to refresh — the cookie either names someone or it does
 * not. The redirect behaviour matches the real gate exactly, so what you test
 * locally is the same flow you get in production.
 */

const PUBLIC_PATHS = ["/login", "/signup", "/reset", "/auth"];

export function localGate(request: NextRequest) {
  const user = localUserFromCookieValue(request.cookies.get("echome_local_email")?.value);
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
