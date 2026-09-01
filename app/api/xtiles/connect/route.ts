import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { siteUrl } from "@/lib/site-url";

/**
 * Begins the xTiles OAuth flow.
 *
 * NOT IMPLEMENTED — we have no xTiles OAuth documentation. See the note at the
 * top of lib/xtiles/http.ts for exactly what is needed. Rather than redirect
 * somewhere invented, this returns the person to their account page with an
 * honest message.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await currentUser();
  const base = await siteUrl();
  if (!user) return NextResponse.redirect(`${base}/login?next=/account`, { status: 303 });

  const authorizeUrl = process.env.XTILES_AUTHORIZE_URL;
  const clientId = process.env.XTILES_CLIENT_ID;

  if (!authorizeUrl || !clientId) {
    return NextResponse.redirect(`${base}/account?xtiles=unconfigured`, { status: 303 });
  }

  const url = new URL(authorizeUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${base}/api/xtiles/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", user.id);
  return NextResponse.redirect(url.toString(), { status: 303 });
}
