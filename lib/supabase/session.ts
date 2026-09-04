import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and gates the app.
 * Called from proxy.ts, which runs before every matched request.
 *
 * Server Components cannot write cookies, so the token refresh has to happen
 * here or a user gets silently logged out when their access token expires
 * mid-conversation — which, for a product built around sessions lasting days,
 * would be the most common bug in the app.
 */

// "/auth" covers /auth/callback and /auth/confirm — the OAuth return trip and
// the emailed-link exchange both have to be reachable while signed out.
const PUBLIC_PATHS = ["/login", "/signup", "/reset", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not put logic between createServerClient and getUser: a stray await here
  // is the classic cause of random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Remember where they were headed, so a resumed session lands them back in
    // the conversation rather than on a generic home page.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
