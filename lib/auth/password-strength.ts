/**
 * A small, dependency-free password strength heuristic — not zxcvbn, on
 * purpose. It only has to steer someone away from "password1" and toward
 * something longer and more varied; it doesn't need a dictionary of
 * breached passwords to do that.
 */

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

const LABELS: readonly string[] = ["Very weak", "Weak", "Fair", "Good", "Strong"];

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwertyuiop",
  "letmein123",
  "iloveyou123",
  "admin12345",
  "welcome123",
]);

const RUNS = ["abcdefghijklmnopqrstuvwxyz", "01234567890", "qwertyuiop"];

/** True for "aaaaaaaa" or any run of 5+ consecutive keyboard/alphabet chars. */
function hasLowEntropyPattern(lower: string): boolean {
  if (/^(.)\1+$/.test(lower)) return true;
  return RUNS.some((run) => {
    for (let i = 0; i + 5 <= run.length; i++) {
      if (lower.includes(run.slice(i, i + 5))) return true;
    }
    return false;
  });
}

export function passwordStrength(value: string): { level: StrengthLevel; label: string } {
  if (value.length === 0) return { level: 0, label: "" };

  let points = 0;
  if (value.length >= 8) points++;
  if (value.length >= 12) points++;
  if (value.length >= 16) points++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points++;
  if (/\d/.test(value)) points++;
  if (/[^A-Za-z0-9]/.test(value)) points++;

  const lower = value.toLowerCase();
  if (COMMON.has(lower) || hasLowEntropyPattern(lower)) {
    points = Math.min(points, 1);
  }

  const level = Math.max(0, Math.min(4, Math.round((points / 6) * 4))) as StrengthLevel;
  return { level, label: LABELS[level]! };
}
