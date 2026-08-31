import { signUp } from "@/app/(auth)/actions";
import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { OAuthButtons, OrDivider } from "@/components/auth/OAuthButtons";
import { DISCLAIMER } from "@/lib/echo/messages";

export default function SignUpPage() {
  return (
    <AuthForm
      title="Start a conversation"
      subtitle="A private space to hear your own thinking."
      action={signUp}
      submitLabel="Create account"
      fields={["email", "password"]}
      passwordLabel="Password (at least 8 characters)"
      passwordAutoComplete="new-password"
      above={
        <div className="flex flex-col gap-5">
          <OAuthButtons />
          <OrDivider label="or sign up with email" />
        </div>
      }
      footer={
        <div className="flex flex-col gap-3">
          <span>
            Already have an account? <AuthLink href="/login">Sign in</AuthLink>
          </span>
          {/* The disclaimer appears at signup as well as persistently in chat. */}
          <p className="text-xs leading-relaxed">{DISCLAIMER}</p>
        </div>
      }
    />
  );
}
