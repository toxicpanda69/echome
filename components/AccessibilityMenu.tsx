"use client";

import { useEffect, useRef, useState } from "react";

import { THEME_STORAGE_KEY, type ThemeChoice } from "@/lib/theme";

const OPTIONS: { value: ThemeChoice; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Bright background" },
  { value: "dark", label: "Dark", hint: "Easier in low light" },
  { value: "system", label: "Match my device", hint: "Follows your system setting" },
];

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function applyChoice(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    if (choice === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked (private window, etc.) — the choice still applies for this visit.
  }
}

/**
 * A small floating button, always reachable, that opens a panel of display
 * options. Today that's the theme; more accessibility settings can land here.
 * The choice is stored in this browser only — it never touches the server.
 */
export function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const rootRef = useRef<HTMLDivElement>(null);

  // Read the stored value after hydration, and re-apply it: in dev, React's
  // Strict Mode remount clears attributes the inline script put on <html>.
  useEffect(() => {
    const stored = readChoice();
    setChoice(stored);
    if (stored !== "system") document.documentElement.setAttribute("data-theme", stored);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
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

  function choose(next: ThemeChoice) {
    setChoice(next);
    applyChoice(next);
  }

  return (
    // Phones: top-right, sitting beside the account avatar. Wider screens: the
    // left edge, vertically centred, clear of the header and the composer.
    <div className="fixed right-16 top-3 z-40 sm:left-3 sm:right-auto sm:top-1/2 sm:-translate-y-1/2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Accessibility options"
        className="flex size-9 items-center justify-center rounded-full sm:size-11 border border-line bg-raised text-ink shadow-md transition hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <AccessibilityIcon />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Accessibility options"
          className="echo-rise absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-raised shadow-xl sm:left-0 sm:right-auto"
        >
          <p className="px-4 pb-1 pt-3.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Theme
          </p>
          <div role="radiogroup" aria-label="Theme" className="flex flex-col gap-0.5 p-1.5">
            {OPTIONS.map((option) => {
              const selected = choice === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(option.value)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-accent-soft ${
                    selected ? "bg-accent-soft text-ink" : "text-ink-soft"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                      selected ? "border-accent" : "border-line"
                    }`}
                  >
                    {selected ? <span className="size-2 rounded-full bg-accent" /> : null}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-ink">{option.label}</span>
                    <span className="text-xs text-ink-soft">{option.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** The universal-access figure, hand-drawn like the rest of the icons here. */
function AccessibilityIcon() {
  return (
    <svg
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
      <circle cx="12" cy="4.5" r="1.7" />
      <path d="M5 8.2c2.2.7 4.6 1 7 1s4.8-.3 7-1" />
      <path d="M12 9.2v5.3" />
      <path d="M12 14.5l-2.6 5.5M12 14.5l2.6 5.5" />
    </svg>
  );
}
