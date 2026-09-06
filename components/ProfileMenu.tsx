"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The avatar in the header. Click it and a small menu drops down with who's
 * signed in and where the rest of the account lives — replaces what used to
 * be a bare "Sign out" button floating on its own.
 */
export function ProfileMenu({
  email,
  signOutAction,
}: {
  email: string | null;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (email?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-accent text-sm font-medium text-on-accent transition hover:opacity-90"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="echo-rise absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-raised py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-20px_rgba(0,0,0,0.35)]"
        >
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-medium">{email ?? "Signed in"}</p>
          </div>

          <MenuLink href="/account" onNavigate={() => setOpen(false)}>
            Account
          </MenuLink>
          <MenuLink href="/settings" onNavigate={() => setOpen(false)}>
            Settings
          </MenuLink>
          <MenuLink href="/policy" onNavigate={() => setOpen(false)}>
            Privacy policy
          </MenuLink>

          <div className="my-1.5 border-t border-line" />

          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-ink-soft transition hover:bg-page hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="block px-4 py-2 text-sm text-ink-soft transition hover:bg-page hover:text-ink"
    >
      {children}
    </Link>
  );
}
