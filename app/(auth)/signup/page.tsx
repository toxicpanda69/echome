import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { signUp } from "@/app/(auth)/actions";
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
