/** EchoMe's mark — soft concentric ripples, drawn simply. */
export function EchoMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 96 96" width={size} height={size} role="img" aria-label="EchoMe">
      <circle cx="48" cy="48" r="44" fill="var(--color-accent-soft)" />
      <circle cx="48" cy="48" r="30" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" opacity="0.45" />
      <circle cx="48" cy="48" r="18" fill="none" stroke="var(--color-accent)" strokeWidth="2.5" opacity="0.7" />
      <circle cx="48" cy="48" r="7" fill="var(--color-accent)" />
    </svg>
  );
}
