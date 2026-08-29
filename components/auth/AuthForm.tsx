"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthState } from "@/app/(auth)/actions";

/**
 * The one form behind sign in, sign up and password reset. Neutral styling —
 * brand comes later.
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
  readonly footer?: React.ReactNode;
}

const INPUT =
  "w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-base " +
  "outline-none transition focus:border-ink-soft focus:ring-2 focus:ring-line";

export function AuthForm({
  title,
  subtitle,
  action,
  submitLabel,
  fields,
  passwordLabel = "Password",
  passwordAutoComplete = "current-password",
  hidden,
  footer,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-ink-soft">{subtitle}</p> : null}

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        {hidden
          ? Object.entries(hidden).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))
          : null}

        {fields.includes("email") ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">Email</span>
            <input
              className={INPUT}
              type="email"
              name="email"
              autoComplete="email"
              required
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
        ) : null}

        {fields.includes("password") ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-ink-soft">{passwordLabel}</span>
            <input
              className={INPUT}
              type="password"
              name="password"
              autoComplete={passwordAutoComplete}
              required
              minLength={8}
            />
          </label>
        ) : null}

        {/*
          GOOGLE OAUTH SLOT.
          A button here calling signInWithOAuth("google") is all that is missing.
          See the note in app/(auth)/actions.ts.
        */}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-base font-medium text-page transition disabled:opacity-50"
        >
          {pending ? "One moment…" : submitLabel}
        </button>

        <p aria-live="polite" className="min-h-5 text-sm">
          {state.error ? <span className="text-red-700 dark:text-red-400">{state.error}</span> : null}
          {state.notice ? <span className="text-ink-soft">{state.notice}</span> : null}
        </p>
      </form>

      {footer ? <div className="mt-6 text-sm text-ink-soft">{footer}</div> : null}
    </main>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-4 hover:text-ink">
      {children}
    </Link>
  );
}
