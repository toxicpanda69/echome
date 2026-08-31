"use client";

import Link from "next/link";

/** Shared form pieces, so the sign-in panel and the other auth pages match. */

export const INPUT =
  "w-full rounded-lg border border-line bg-raised px-3 py-2.5 text-base " +
  "outline-none transition focus:border-ink-soft focus:ring-2 focus:ring-line";

export function EmailField({ autoFocus = false }: { autoFocus?: boolean }) {
  return (
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
        autoFocus={autoFocus}
      />
    </label>
  );
}

export function PasswordField({
  label = "Password",
  autoComplete = "current-password",
}: {
  label?: string;
  autoComplete?: "current-password" | "new-password";
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-soft">{label}</span>
      <input className={INPUT} type="password" name="password" autoComplete={autoComplete} required minLength={8} />
    </label>
  );
}

export function PrimaryButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-lg bg-ink px-4 py-2.5 text-base font-medium text-page transition disabled:opacity-50"
    >
      {pending ? "One moment…" : children}
    </button>
  );
}

/** Reserves its own height so the form does not jump when a message appears. */
export function FormMessage({ error, notice }: { error?: string; notice?: string }) {
  return (
    <p aria-live="polite" className="min-h-5 text-sm leading-relaxed">
      {error ? <span className="text-red-700 dark:text-red-400">{error}</span> : null}
      {notice ? <span className="text-ink-soft">{notice}</span> : null}
    </p>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline underline-offset-4 hover:text-ink">
      {children}
    </Link>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      {children}
    </main>
  );
}
