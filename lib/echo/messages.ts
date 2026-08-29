/**
 * Every user-facing string that is not part of EchoMe's voice.
 *
 * Kept in one file because the final wording belongs to the client, and because
 * a phrase shown to someone mid-reflection deserves to be reviewed as copy
 * rather than discovered inside a catch block.
 *
 * EchoMe's personality does NOT live here — that is lib/echo/skill.md. These are
 * the things the application says on its own behalf: disclaimers, and what a
 * person sees when something goes wrong.
 *
 * PLACEHOLDER WORDING. Client to confirm.
 */

export const DISCLAIMER =
  "EchoMe is not therapy, and not a substitute for it. If you are struggling, " +
  "please reach out to someone who can help.";

export const DISCLAIMER_SHORT = "EchoMe is not therapy.";

/**
 * Shown when the model declines to continue (stop_reason === "refusal").
 * This is not an error and must not read like one. The person has usually just
 * said something difficult, and a red box would be the wrong answer.
 */
export const REFUSAL =
  "I'm not able to follow that thread. It isn't a judgement on you — there are " +
  "places I'm built not to go. We can pick this up somewhere else whenever you're ready.";

/** The model or the network was unavailable. Their words were still saved. */
export const UPSTREAM_UNAVAILABLE =
  "I couldn't reach my thoughts just then. What you wrote is saved — try sending it again in a moment.";

export const RATE_LIMITED =
  "Too much at once for me to keep up with. Give it a minute and try again — nothing is lost.";

/** The session key is gone. This is the successful erasure, described plainly. */
export const SESSION_CLOSED =
  "This conversation has been closed, and its contents were destroyed when it ended. " +
  "That is by design. You can start a new one whenever you like.";

/** Decryption failed for a reason that is not destruction. Genuinely bad. */
export const SESSION_UNREADABLE =
  "Something is wrong with this conversation and I can't open it. Nothing you wrote " +
  "has been exposed — it simply can't be read any more. Starting fresh is the only way forward.";

export const NOT_SIGNED_IN = "Please sign in to continue.";

export const GENERIC_ERROR =
  "Something went wrong on our side. Nothing you wrote has been lost. Please try again.";
