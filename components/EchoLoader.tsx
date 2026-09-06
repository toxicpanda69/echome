import { EchoMark } from "@/components/EchoMark";

/**
 * The shared "something is happening" moment: the mark breathing, with two
 * rings echoing outward from it. Used wherever a person is waiting on the
 * server — resuming a session, distilling a conversation, writing to xTiles.
 */
export function EchoLoader({
  label,
  size = 56,
}: {
  label?: string;
  size?: number;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <span
          aria-hidden="true"
          className="echo-ripple absolute inset-0 rounded-full border-2 border-accent"
          style={{ animationDelay: "0s" }}
        />
        <span
          aria-hidden="true"
          className="echo-ripple absolute inset-0 rounded-full border-2 border-accent"
          style={{ animationDelay: "0.9s" }}
        />
        <EchoMark size={size} animated />
      </span>
      {label ? (
        <p role="status" className="text-center text-sm leading-relaxed text-ink-soft">
          {label}
        </p>
      ) : null}
    </div>
  );
}

/** Three small dots, breathing in sequence — for inline, low-ceremony waits.
    Dots take their color from `currentColor`, so they read correctly both on
    the page background and inside a filled accent button. */
export function EchoDots({ label, className = "text-ink-soft" }: { label?: string; className?: string }) {
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex items-center gap-1">
        <span className="echo-dot size-1.5 rounded-full bg-current" style={{ animationDelay: "0ms" }} />
        <span className="echo-dot size-1.5 rounded-full bg-current" style={{ animationDelay: "160ms" }} />
        <span className="echo-dot size-1.5 rounded-full bg-current" style={{ animationDelay: "320ms" }} />
      </span>
      {label ? <span className="text-sm">{label}</span> : null}
    </span>
  );
}
