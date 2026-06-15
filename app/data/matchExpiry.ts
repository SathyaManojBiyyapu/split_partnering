// Match expiry: 7 days uniform for all categories (Section 4)
export const MATCH_EXPIRY_DAYS: Record<string, number> = {};

export const DEFAULT_EXPIRY_DAYS = 7;

export function getExpiryDate(createdAt: any): Date | null {
  if (!createdAt?.seconds) return null;
  const date = new Date(createdAt.seconds * 1000);
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS);
  return date;
}

export function isExpired(createdAt: any, category?: string): boolean {
  if (!createdAt?.seconds) return false;
  const created = new Date(createdAt.seconds * 1000);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= DEFAULT_EXPIRY_DAYS;
}

// Section 5: Match Expiration Tracking - Returns status and label
export function getExpiryStatus(createdAt: any): {
  status: "active" | "matching" | "expiring-soon" | "expired";
  label: string;
  daysLeft: number;
  progress: number; // 0 to 100
} {
  if (!createdAt?.seconds) {
    return { status: "active", label: "Active", daysLeft: 7, progress: 0 };
  }

  const created = new Date(createdAt.seconds * 1000);
  const now = new Date();
  const totalMs = DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - created.getTime();
  const remainingMs = totalMs - elapsedMs;

  if (remainingMs <= 0) {
    return { status: "expired", label: "Expired", daysLeft: 0, progress: 100 };
  }

  const daysLeft = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
  const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));

  let status: "active" | "matching" | "expiring-soon" | "expired" = "active";
  let label = `${daysLeft} Day${daysLeft > 1 ? "s" : ""} Left`;

  if (daysLeft <= 0) {
    status = "expired";
    label = "Expired";
  } else if (daysLeft <= 1) {
    status = "expiring-soon";
    label = "Expiring Today";
  } else if (daysLeft <= 3) {
    status = "expiring-soon";
    label = `${daysLeft} Days Left`;
  } else {
    status = "active";
    label = `${daysLeft} Days Left`;
  }

  return { status, label, daysLeft, progress };
}

// Section 22: Compatibility Score
export function computeCompatibility(
  userProfile: any,
  partnerProfile: any
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (userProfile?.city && partnerProfile?.city && userProfile.city === partnerProfile.city) {
    score += 40;
    reasons.push("✓ Same City");
  }

  if (userProfile?.category && partnerProfile?.category && userProfile.category === partnerProfile.category) {
    score += 25;
    reasons.push("✓ Same Category");
  }

  if (userProfile?.budget && partnerProfile?.budget && Math.abs(userProfile.budget - partnerProfile.budget) <= 500) {
    score += 20;
    reasons.push("✓ Similar Budget");
  }

  if (userProfile?.goals && partnerProfile?.goals && userProfile.goals === partnerProfile.goals) {
    score += 15;
    reasons.push("✓ Similar Goals");
  }

  if (score === 0) score = 15; // minimum compatibility

  return { score: Math.min(100, score), reasons };
}