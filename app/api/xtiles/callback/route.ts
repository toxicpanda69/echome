import { NextResponse, type NextRequest } from "next/server";

import { currentUser } from "@/lib/auth/current-user";
import { siteUrl } from "@/lib/site-url";

/**
 * The xTiles OAuth return trip.
 *
 * NOT IMPLEMENTED — the token exchange needs their token endpoint and payload
 * shape, which we do not have. lib/xtiles/tokens.ts is finished and will
 * encrypt whatever this hands it; only the exchange itself is missing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = await siteUrl();
  const user = await currentUser();
  if (!user) return NextResponse.redirect(`${base}/login?next=/account`, { status: 303 });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // The state must be the user who started the flow, or this is a CSRF attempt.
  if (!code || state !== user.id) {
    return NextResponse.redirect(`${base}/account?xtiles=error`, { status: 303 });
  }

  // TODO: exchange `code` for tokens, then:
  //   await saveTokens(user.id, { accessToken, refreshToken, expiresAt, workspaceId });
  return NextResponse.redirect(`${base}/account?xtiles=unconfigured`, { status: 303 });
}
