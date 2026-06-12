// Match expiry durations in days per category
export const MATCH_EXPIRY_DAYS: Record<string, number> = {
  "movies": 7,
  "gym": 30,
  "fashion": 30,
  "local-travel": 30,
  "lenskart": 30,
  "events": 15,
  "coupons": 15,
  "villas": 30,
  "books": 30,
};

export const DEFAULT_EXPIRY_DAYS = 30;

export function getExpiryDate(category: string): Date {
  const days = MATCH_EXPIRY_DAYS[category] || DEFAULT_EXPIRY_DAYS;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function isExpired(createdAt: any, category: string): boolean {
  if (!createdAt?.seconds) return false;
  const days = MATCH_EXPIRY_DAYS[category] || DEFAULT_EXPIRY_DAYS;
  const created = new Date(createdAt.seconds * 1000);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= days;
}