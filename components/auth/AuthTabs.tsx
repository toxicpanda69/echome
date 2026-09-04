"use client";

import Link from "next/link";

/** Segmented Sign in / Sign up switcher at the top of the auth card. */
export function AuthTabs({ active }: { active: "signin" | "signup" }) {
  return (
    <div className="flex gap-1 rounded-full border border-line bg-page p-1">
      <Link
        href="/login"
        className={`flex-1 rounded-full py-2 text-center text-sm font-medium transition ${
          active === "signin" ? "bg-ink text-page" : "text-ink-soft hover:text-ink"
        }`}
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className={`flex-1 rounded-full py-2 text-center text-sm font-medium transition ${
          active === "signup" ? "bg-ink text-page" : "text-ink-soft hover:text-ink"
        }`}
      >
        Sign up
      </Link>
    </div>
  );
}
