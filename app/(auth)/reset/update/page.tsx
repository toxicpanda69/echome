import { AuthForm } from "@/components/auth/AuthForm";
import { updatePassword } from "@/app/(auth)/actions";

/**
 * Reached only through a reset link, which puts a recovery session in place
 * before this page renders.
 */
export default function UpdatePasswordPage() {
  return (
    <AuthForm
      title="Choose a new password"
      action={updatePassword}
      submitLabel="Save password"
      fields={["password"]}
      passwordLabel="New password (at least 8 characters)"
      passwordAutoComplete="new-password"
    />
  );
}
