import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { signIn } from "@/app/(auth)/actions";
import { DISCLAIMER_SHORT } from "@/lib/echo/messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Your conversation is where you left it."
      action={signIn}
      submitLabel="Sign in"
      fields={["email", "password"]}
      hidden={next?.startsWith("/") ? { next } : undefined}
      footer={
        <div className="flex flex-col gap-2">
          <span>
            <AuthLink href="/reset">Forgotten your password?</AuthLink>
          </span>
          <span>
            No account yet? <AuthLink href="/signup">Sign up</AuthLink>
          </span>
          <span className="pt-2 text-xs">{DISCLAIMER_SHORT}</span>
        </div>
      }
    />
  );
}
