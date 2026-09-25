"use client";

import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The theme actually on screen: the saved choice if there is one, else the device's. */
function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/**
 * A round button fixed to the top-left: a sun in light mode, a crescent moon in
 * dark mode. One click flips the theme. Until the first click EchoMe follows the
 * device; after that the choice is remembered in this browser only — it never
 * touches the server.
 *
 * Which icon shows is decided in CSS (see .theme-toggle__* in globals.css) so it
 * is correct on first paint; state here only drives the accessible label.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Re-apply the saved choice: in dev, React's Strict Mode remount clears
    // attributes the inline script put on <html>.
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch {
      // Storage blocked — fall through to the device setting.
    }
    setTheme(currentTheme());

    // While there is no saved choice, follow the device if it changes.
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setTheme(currentTheme());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked (private window, etc.) — it still applies for this visit.
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="fixed left-3 top-3 z-40 flex size-9 items-center justify-center rounded-full border border-line bg-raised text-ink shadow-sm transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      style={{ left: "max(0.75rem, env(safe-area-inset-left))" }}
    >
      <svg
        className="theme-toggle__sun"
        viewBox="0 0 24 24"
        width={20}
        height={20}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
      </svg>
      <svg
        className="theme-toggle__moon"
        viewBox="0 0 24 24"
        width={20}
        height={20}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7z" />
      </svg>
    </button>
  );
}
