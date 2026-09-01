/**
 * Crisis resources.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  THE RESOURCE LIST AND ITS WORDING COME FROM THE CLIENT. DO NOT INVENT THEM.
 *
 *  From the build brief: "When it flags, surface crisis resources in the
 *  interface. The wording and the resource list come from the client — put them
 *  in one config file, not in code."
 *
 *  This is that file, and it is deliberately close to empty. Making up mental
 *  health referrals is the one guess in this codebase that could actually harm
 *  somebody: a wrong number, a service that does not operate in their country,
 *  or a line that has closed is worse than no list at all.
 *
 *  Until RESOURCES has real entries, the interface shows FALLBACK below — which
 *  says something true and unspecific rather than something confident and wrong.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CrisisResource {
  readonly name: string;
  /** Displayed verbatim. A phone number, a short code, a URL. */
  readonly contact: string;
  readonly detail: string;
  /** ISO country codes this applies to, or "*" for anywhere. */
  readonly regions: readonly string[];
}

/** CLIENT TO SUPPLY. Every entry must be verified before launch. */
export const RESOURCES: readonly CrisisResource[] = [];

/** Shown while RESOURCES is empty, and to anyone no listed resource covers. */
export const FALLBACK = {
  heading: "If you need someone now",
  body:
    "I'm not able to help in the way you might need right now, and I don't want " +
    "to pretend otherwise. Please contact your local emergency number, or a " +
    "crisis line in your country — they are staffed by people who can.",
} as const;

/** Copy shown alongside the resources. CLIENT TO CONFIRM. */
export const CRISIS_INTRO =
  "I noticed something in what you wrote that I don't want to move past.";

export function resourcesFor(region: string | null): readonly CrisisResource[] {
  if (RESOURCES.length === 0) return [];
  return RESOURCES.filter((r) => r.regions.includes("*") || (region && r.regions.includes(region)));
}

/** True while the client has not yet supplied a list. */
export const USING_FALLBACK = RESOURCES.length === 0;
