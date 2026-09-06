import { SignInPanel } from "@/components/auth/SignInPanel";
import { LINK_EXPIRED, OAUTH_FAILED } from "@/lib/echo/messages";
import { LOCAL_MODE } from "@/lib/local/mode";

/** Banners raised by /auth/callback and /auth/confirm when a round trip fails. */
const BANNERS: Readonly<Record<string, string>> = {
  oauth: OAUTH_FAILED,
  link: LINK_EXPIRED,
};

/**
 * The same screen in local mode and in the real app — SignInPanel decides
 * which action each form submits to based on the `localMode` prop below.
 *
 * LOCAL_MODE is read here rather than inside SignInPanel because this is a
 * server component: the env var is resolved correctly at request time and the
 * boolean is passed down already-decided, so the client never has to (and
 * cannot) re-evaluate it — see the note in SignInPanel for why that matters.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = next?.startsWith("/") ? next : undefined;

  return (
    <SignInPanel
      next={destination}
      banner={error ? BANNERS[error] : undefined}
      localMode={LOCAL_MODE}
    />
  );
}
