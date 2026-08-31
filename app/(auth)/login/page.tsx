import { SignInPanel } from "@/components/auth/SignInPanel";
import { LocalSignIn } from "@/components/local/LocalSignIn";
import { LOCAL_MODE } from "@/lib/local/mode";
import { LINK_EXPIRED, OAUTH_FAILED } from "@/lib/echo/messages";

/** Banners raised by /auth/callback and /auth/confirm when a round trip fails. */
const BANNERS: Readonly<Record<string, string>> = {
  oauth: OAUTH_FAILED,
  link: LINK_EXPIRED,
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const destination = next?.startsWith("/") ? next : undefined;

  // A completely separate screen rather than a variant of the real one, so the
  // two can never be confused for each other.
  if (LOCAL_MODE) return <LocalSignIn next={destination} />;

  return <SignInPanel next={destination} banner={error ? BANNERS[error] : undefined} />;
}
