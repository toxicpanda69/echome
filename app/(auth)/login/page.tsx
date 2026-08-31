import { SignInPanel } from "@/components/auth/SignInPanel";
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

  return (
    <SignInPanel
      next={next?.startsWith("/") ? next : undefined}
      banner={error ? BANNERS[error] : undefined}
    />
  );
}
