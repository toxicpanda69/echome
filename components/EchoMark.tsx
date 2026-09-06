"use client";

import { useId } from "react";

/**
 * EchoMe's mark — two profiles facing each other, the shared silhouette
 * between them reading as a single vessel. Echo, meeting itself.
 *
 * `animated` adds a slow breathing pulse for loading contexts; it respects
 * prefers-reduced-motion via the `echo-breathe` keyframes in globals.css.
 */
export function EchoMark({
  size = 40,
  animated = false,
}: {
  size?: number;
  animated?: boolean;
}) {
  // The gradient needs a DOM-unique id — two marks on one page (a header
  // plus a loader, say) would otherwise both point at the first <defs> in
  // the document, since SVG's url(#id) resolution ignores duplicates.
  const gradientId = `echoMarkFill-${useId()}`;

  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      role="img"
      aria-label="EchoMe"
      className={animated ? "echo-breathe" : undefined}
    >
      <defs>
        <radialGradient id={gradientId} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.82" />
          <stop offset="100%" stopColor="var(--color-accent)" />
        </radialGradient>
      </defs>
      <circle cx="48" cy="48" r="46" fill="var(--color-accent-soft)" />
      <circle cx="48" cy="48" r="37" fill={`url(#${gradientId})`} />
      <path
        d="M 48,16 C 59,16 64,22 64,28 C 64,34 55,37 53,43 C 51,47 60,50 63,56
           C 65,60 56,64 54,70 C 53,74 62,77 48,85 C 34,77 43,74 42,70
           C 40,64 31,60 33,56 C 36,50 45,47 43,43 C 41,37 32,34 32,28
           C 32,22 37,16 48,16 Z"
        fill="var(--color-on-accent)"
        opacity="0.92"
      />
    </svg>
  );
}
