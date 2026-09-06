// Pure helpers for the movie-ticket RATE field (unit-testable, no imports).
//
// Business rule: a ticket rate is a whole number with AT MOST 4 digits —
// 100, 500, 1500 and 9999 are valid; 10000+ and anything non-numeric is not.
// The UI input mask alone is NOT trusted — the same constraint is enforced
// server-side in firestore.rules (rules execute on Google's servers and
// cannot be bypassed by direct API calls).

export const MAX_TICKET_RATE = 9999;

/**
 * Input mask for the rate field: strips every non-digit and hard-caps the
 * value at 4 digits, so "12a34" → "1234", "12345" → "1234".
 */
export function sanitizeTicketRateInput(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\D/g, "")
    .slice(0, 4);
}

/**
 * Validates a rate in its PERSISTED form (number) or as typed text.
 * Accepts: 0-9999 (whole numbers, up to 4 digits).
 * Rejects: 5+ digits, negatives, decimals, NaN, non-numeric strings.
 */
export function isValidTicketRate(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 0 && value <= MAX_TICKET_RATE;
  }
  if (typeof value === "string") {
    return /^\d{1,4}$/.test(value.trim());
  }
  return false;
}
