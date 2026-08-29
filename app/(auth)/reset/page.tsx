import { AuthForm, AuthLink } from "@/components/auth/AuthForm";
import { requestPasswordReset } from "@/app/(auth)/actions";

export default function ResetPage() {
  return (
    <AuthForm
      title="Reset your password"
      subtitle="We'll email you a link."
      action={requestPasswordReset}
      submitLabel="Send reset link"
      fields={["email"]}
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    />
  );
}
