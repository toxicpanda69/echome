"use client";

import Link from "next/link";
import { useState } from "react";

import { EchoDots } from "@/components/EchoLoader";
import { EchoMark } from "@/components/EchoMark";
import { passwordStrength } from "@/lib/auth/password-strength";

/** Shared form pieces, so the sign-in panel and the other auth pages match. */

export const INPUT =
  "w-full rounded-xl border border-line bg-raised px-3.5 py-2.5 text-base " +
  "outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-soft";

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
  trailing,
}: {
  label?: string;
  autoComplete?: "current-password" | "new-password";
  /** Rendered top-right of the label row — the "Forgotten password?" link. */
  trailing?: React.ReactNode;
}) {
  // The strength meter only makes sense while someone is choosing a new
  // password — signing in with an existing one gets no meter.
  const showStrength = autoComplete === "new-password";
  const [value, setValue] = useState("");

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between">
        <span className="text-sm text-ink-soft">{label}</span>
        {trailing}
      </span>
      <input
        className={INPUT}
        type="password"
        name="password"
        autoComplete={autoComplete}
        required
        minLength={8}
        value={showStrength ? value : undefined}
        onChange={showStrength ? (event) => setValue(event.target.value) : undefined}
      />
      {showStrength ? <PasswordStrengthMeter value={value} /> : null}
    </label>
  );
}

/** A bar that fills and recolors as the password gets stronger, plus a label
    for anyone using a screen reader. Width and color both transition, so
    typing reads as continuous motion rather than a state that snaps. */
function PasswordStrengthMeter({ value }: { value: string }) {
  const { level, label } = passwordStrength(value);
  const widthPercent = value.length === 0 ? 0 : ((level + 1) / 5) * 100;
  const color =
    level <= 1 ? "var(--color-warn)" : level === 2 ? "var(--color-accent)" : "var(--color-success)";

  return (
    <div className="mt-1 flex flex-col gap-1" aria-hidden={value.length === 0}>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full transition-[width,background-color] duration-300 ease-out"
          style={{ width: `${widthPercent}%`, backgroundColor: color }}
        />
      </div>
      {value.length > 0 ? (
        <p role="status" className="text-xs text-ink-soft">
          {label}
        </p>
      ) : null}
    </div>
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
      className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-base font-medium text-on-accent transition hover:opacity-90 disabled:opacity-50"
    >
      {pending ? <EchoDots label="One moment…" className="text-on-accent" /> : children}
      {pending ? null : <span aria-hidden="true">→</span>}
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
    <Link href={href} className="text-accent underline underline-offset-4 hover:text-ink">
      {children}
    </Link>
  );
}

/**
 * The card every auth screen sits inside — a soft radial glow behind a
 * rounded, bordered card, with EchoMe's mark anchoring the top. Same shell
 * language across sign in, sign up, reset, and local mode, so the "feel" is
 * consistent everywhere a person signs in.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(120% 100% at 50% 0%, color-mix(in oklch, var(--color-accent-soft) 45%, var(--color-page)) 0%, var(--color-page) 60%)",
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-line bg-raised px-7 py-9 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-20px_rgba(0,0,0,0.25)]">
        <div className="mb-5 flex justify-center">
          <span className="flex items-center gap-2 rounded-full border border-line bg-page px-3 py-1.5">
            <EchoMark size={20} />
            <span className="text-sm font-medium">EchoMe</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
