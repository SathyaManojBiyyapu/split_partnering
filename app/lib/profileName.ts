// Pure helpers for the profile Name field lifecycle (unit-testable, no
// firebase/next imports).
//
// The name is an identity field: once it has been SUCCESSFULLY SAVED to
// Firestore it is fixed forever. But while the user is still typing (new user,
// no saved name yet) the field must stay fully editable — the lock may only
// engage after a successful save, NEVER based on the live input value
// (keying the lock off the live value is what caused the "one character only"
// bug: typing "M" made the value truthy and instantly locked the field).

/**
 * Whether the Name input should be read-only.
 * Locked ONLY when a name has actually been persisted (nameSaved — loaded
 * from the user's Firestore doc or written by a successful save) — and never
 * for guests (guests cannot save at all).
 */
export function shouldLockName(nameSaved: boolean, isGuest: boolean): boolean {
  return !isGuest && nameSaved;
}

/**
 * The name to persist when saving a profile.
 * - An existing saved name always wins (identity is preserved forever).
 * - Otherwise the newly typed name is saved in FULL — never truncated to its
 *   first character.
 */
export function resolveSavedName(existingName: unknown, typedName: unknown): string {
  const existing = String(existingName ?? "").trim();
  if (existing) return existing;
  return String(typedName ?? "").trim();
}
