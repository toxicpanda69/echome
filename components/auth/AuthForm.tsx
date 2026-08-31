"use client";

import { useActionState } from "react";

import type { AuthState } from "@/app/(auth)/actions";
import {
  AuthShell,
  EmailField,
  FormMessage,
  PasswordField,
  PrimaryButton,
} from "@/components/auth/fields";

export { AuthLink } from "@/components/auth/fields";

/**
 * The form behind sign up, password reset and choosing a new password. The
 * sign-in page has its own panel, because it carries the social buttons and the
 * password/magic-link choice.
 */

interface AuthFormProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  readonly submitLabel: string;
  readonly fields: ReadonlyArray<"email" | "password">;
  readonly passwordLabel?: string;
  readonly passwordAutoComplete?: "current-password" | "new-password";
  readonly hidden?: Readonly<Record<string, string>>;
  /** Rendered above the form — the social buttons on the signup page. */
  readonly above?: React.ReactNode;
  readonly footer?: React.ReactNode;
}

export function AuthForm({
  title,
  subtitle,
  action,
  submitLabel,
  fields,
  passwordLabel,
  passwordAutoComplete = "current-password",
  hidden,
  above,
  footer,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <AuthShell>
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-ink-soft">{subtitle}</p> : null}

      {above ? <div className="mt-8">{above}</div> : null}

      <form action={formAction} className={`flex flex-col gap-4 ${above ? "mt-5" : "mt-8"}`}>
        {hidden
          ? Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}

        {fields.includes("email") ? <EmailField /> : null}
        {fields.includes("password") ? (
          <PasswordField label={passwordLabel} autoComplete={passwordAutoComplete} />
        ) : null}

        <PrimaryButton pending={pending}>{submitLabel}</PrimaryButton>
        <FormMessage error={state.error} notice={state.notice} />
      </form>

      {footer ? <div className="mt-6 text-sm text-ink-soft">{footer}</div> : null}
    </AuthShell>
  );
}
