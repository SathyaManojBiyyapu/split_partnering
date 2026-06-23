// Match expiry: 10 days uniform for all categories
export const MATCH_EXPIRY_DAYS: Record<string, number> = {};

export const DEFAULT_EXPIRY_DAYS = 90;

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

// Section 5: Match Expiration Tracking
export function getExpiryStatus(createdAt: any): {
  status: "active" | "matching" | "expiring-soon" | "expired";
  label: string;
  daysLeft: number;
  progress: number;
} {
  if (!createdAt?.seconds) {
    return { status: "active", label: "Active", daysLeft: 90, progress: 0 };
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
  } else if (daysLeft <= 7) {
    status = "expiring-soon";
    label = `${daysLeft} Days Left`;
  } else {
    status = "active";
    label = `${daysLeft} Days Left (90 day expiry)`;
  }

  return { status, label, daysLeft, progress };
}

// Generate stable User ID from phone
export function generateUserId(phone: string): string {
  if (!phone) return "PS-00000";
  // Use last 5 digits of phone for a stable ID
  const digits = phone.replace(/\D/g, "");
  const id = digits.slice(-5);
  return `PS-${id}`;
}

// Section 4 updated: Compatibility based on location + category/subcategory match
export function computeCompatibility(
  userProfile: any,
  partnerProfile: any
): { score: number; label: string; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const sameState = userProfile?.state && partnerProfile?.state && userProfile.state === partnerProfile.state;
  const sameDistrict = userProfile?.district && partnerProfile?.district && userProfile.district === partnerProfile.district;
  const sameCity = userProfile?.city && partnerProfile?.city && userProfile.city === partnerProfile.city;
  const sameCategory = userProfile?.category && partnerProfile?.category && userProfile.category === partnerProfile.category;
  const sameSubcategory = userProfile?.option && partnerProfile?.option && userProfile.option === partnerProfile.option;

  // Highest priority: Same state + same city + same category + same subcategory
  if (sameState && sameCity && sameCategory && sameSubcategory) {
    score = 98;
    if (sameState) reasons.push("✓ Same State");
    if (sameCity) reasons.push("✓ Same City");
    if (sameCategory) reasons.push("✓ Same Category");
    if (sameSubcategory) reasons.push("✓ Same Subcategory");
  }
  // Same state + same city + same category (different subcategory)
  else if (sameState && sameCity && sameCategory) {
    score = 90;
    if (sameState) reasons.push("✓ Same State");
    if (sameCity) reasons.push("✓ Same City");
    if (sameCategory) reasons.push("✓ Same Category");
  }
  // Same state + same city (different category)
  else if (sameState && sameCity) {
    score = 85;
    reasons.push("✓ Same State");
    reasons.push("✓ Same City");
  }
  // Same state + same district
  else if (sameState && sameDistrict) {
    score = 75;
    reasons.push("✓ Same State");
    reasons.push("✓ Same District");
  }
  // Same state only
  else if (sameState) {
    score = 60;
    reasons.push("✓ Same State");
  }
  // Different states but same category
  else if (sameCategory) {
    score = 40;
    reasons.push("✓ Same Category");
  }
  // No matches
  else {
    score = 25;
    reasons.push("✓ General Match");
  }

  // Bonus for category match even if already scored higher
  if (sameCategory && !reasons.includes("✓ Same Category")) {
    reasons.push("✓ Same Category");
  }
  // Bonus for subcategory match even if already scored higher
  if (sameSubcategory && !reasons.includes("✓ Same Subcategory")) {
    reasons.push("✓ Same Subcategory");
  }

  return { score, label: `${score}%`, reasons };
}
