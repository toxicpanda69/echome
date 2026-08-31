"use client";

import { useActionState } from "react";

import { localSignIn } from "@/app/(auth)/local-actions";
import type { AuthState } from "@/app/(auth)/actions";
import { AuthShell, EmailField, FormMessage, PrimaryButton } from "@/components/auth/fields";
import { DISCLAIMER_SHORT } from "@/lib/echo/messages";

/**
 * The local-mode sign-in screen. Intentionally does not look like the real one:
 * no password, no social buttons, and a plain statement of what it is. If this
 * ever appears somewhere it should not, it should be obvious at a glance.
 */
export function LocalSignIn({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(localSignIn, {});

  return (
    <AuthShell>
      <h1 className="text-2xl font-medium tracking-tight">Sign in (local)</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Any email address will do — nothing is verified and no password is asked for. Use two
        different addresses to check that one person cannot see another&rsquo;s conversation.
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <EmailField autoFocus />
        <PrimaryButton pending={pending}>Continue</PrimaryButton>
        <FormMessage error={state.error} notice={state.notice} />
      </form>

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        Google, Facebook, magic links and password reset all need Supabase and are unavailable
        here. {DISCLAIMER_SHORT}
      </p>
    </AuthShell>
  );
}
