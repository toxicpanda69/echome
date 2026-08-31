"use client";

import { useActionState, useState } from "react";

import { sendMagicLink, signIn, type AuthState } from "@/app/(auth)/actions";
import { OAuthButtons, OrDivider } from "@/components/auth/OAuthButtons";
import {
  AuthLink,
  AuthShell,
  EmailField,
  FormMessage,
  PasswordField,
  PrimaryButton,
} from "@/components/auth/fields";
import { DISCLAIMER_SHORT } from "@/lib/echo/messages";

/**
 * The sign-in page.
 *
 * Three ways in, in the order most people will use them: a social provider, a
 * password, or a link in the post. The mode toggle swaps the bottom half only —
 * the social buttons stay put, so nothing moves under the cursor.
 */

type Mode = "password" | "link";

export function SignInPanel({ next, banner }: { next?: string; banner?: string }) {
  const [mode, setMode] = useState<Mode>("password");

  return (
    <AuthShell>
      <h1 className="text-2xl font-medium tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-soft">Your conversation is where you left it.</p>

      {banner ? (
        <p
          role="status"
          className="mt-5 rounded-lg border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-sm leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {banner}
        </p>
      ) : null}

      <div className="mt-8">
        <OAuthButtons next={next} />
      </div>

      <div className="mt-5">
        <OrDivider />
      </div>

      {mode === "password" ? (
        <PasswordMode next={next} onUseLink={() => setMode("link")} />
      ) : (
        <LinkMode next={next} onUsePassword={() => setMode("password")} />
      )}

      <div className="mt-6 flex flex-col gap-2 text-sm text-ink-soft">
        <span>
          No account yet? <AuthLink href="/signup">Sign up</AuthLink>
        </span>
        <span className="pt-2 text-xs">{DISCLAIMER_SHORT}</span>
      </div>
    </AuthShell>
  );
}

function PasswordMode({ next, onUseLink }: { next?: string; onUseLink: () => void }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signIn, {});

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <EmailField />
      <PasswordField />
      <PrimaryButton pending={pending}>Sign in</PrimaryButton>
      <FormMessage error={state.error} notice={state.notice} />
      <div className="flex flex-col gap-2 text-sm text-ink-soft">
        <ModeToggle onClick={onUseLink}>Email me a link instead</ModeToggle>
        <span>
          <AuthLink href="/reset">Forgotten your password?</AuthLink>
        </span>
      </div>
    </form>
  );
}

function LinkMode({ next, onUsePassword }: { next?: string; onUsePassword: () => void }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(sendMagicLink, {});

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <EmailField />
      <p className="-mt-1 text-sm leading-relaxed text-ink-soft">
        No password needed. We&rsquo;ll send a link that signs you in.
      </p>
      <PrimaryButton pending={pending}>Send me a link</PrimaryButton>
      <FormMessage error={state.error} notice={state.notice} />
      <ModeToggle onClick={onUsePassword}>Use a password instead</ModeToggle>
    </form>
  );
}

function ModeToggle({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start underline underline-offset-4 hover:text-ink"
    >
      {children}
    </button>
  );
}
