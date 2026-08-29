import { DISCLAIMER } from "@/lib/echo/messages";

/**
 * Visible but quiet. It should be readable by anyone who looks for it and
 * should not compete with the conversation for attention.
 */
export function Disclaimer() {
  return (
    <p className="px-4 pb-2 text-center text-xs leading-relaxed text-ink-soft">
      {DISCLAIMER}
    </p>
  );
}
