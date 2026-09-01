import { CRISIS_INTRO, FALLBACK, RESOURCES, USING_FALLBACK } from "@/lib/config/crisis";

/**
 * Shown when the watchman flags a message.
 *
 * It appears alongside the conversation. It does not interrupt it, replace the
 * reply, or close anything — the brief is explicit that the watchman never
 * blocks, and this component honours that.
 *
 * While the client has not supplied a resource list, this shows the fallback:
 * something true and unspecific, rather than a phone number we guessed at.
 */
export function CrisisPanel() {
  return (
    <aside
      role="note"
      className="mt-5 rounded-xl border border-line bg-raised px-4 py-4 text-sm leading-relaxed"
    >
      <p className="text-ink-soft">{CRISIS_INTRO}</p>

      {USING_FALLBACK ? (
        <div className="mt-3">
          <p className="font-medium">{FALLBACK.heading}</p>
          <p className="mt-1 text-ink-soft">{FALLBACK.body}</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {RESOURCES.map((resource) => (
            <li key={resource.name}>
              <p className="font-medium">{resource.name}</p>
              <p className="text-ink-soft">{resource.contact}</p>
              <p className="text-ink-soft">{resource.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
