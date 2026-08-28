// Shared, pure matching logic used by EVERY partner-matching entry point.
// Single source of truth for first-come-first-served group selection so the
// client flows (save, create-group) and the atomic server route can never
// drift apart. This module is intentionally free of firebase/next imports so
// it can be unit-tested directly.

export const OPEN_STATUSES = ["waiting", "new", "open", "pending", "found"];

export const GROUP_SIZE: Record<string, number> = {
  split: 2,
  pass: 2,
  supplements: 3,
  "peter-england": 2,
  "louis-philippe": 2,
  unlimited: 2,
  trends: 2,
  wrogn: 2,
  wildcraft: 2,
  zara: 2,
  hm: 2,
  nike: 2,
  adidas: 2,
  "save-ticket": 2,
  "bulk-ticket": 2,
  splitbuy: 2,
  "lens-split": 2,
  car: 4,
  bike: 2,
  "couple-entry": 2,
  "group-save": 4,
  "best-deals": 2,
  "gift-card": 2,
  room: 6,
  weekend: 4,
  java: 2,
  python: 2,
  c: 2,
  dsa: 2,
  oops: 2,
  cn: 2,
  dbms: 2,
  os: 2,
  "previous-papers": 2,
};

export const getRequiredSize = (option: string) => GROUP_SIZE[option] || 2;

export const maskPhone = (phone: string) => {
  if (!phone) return "Hidden";
  if (phone.length < 5) return "xxxxx";
  return "xxxxx" + phone.slice(-5);
};

export const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function memberList(g: any): any[] {
  return Array.isArray(g?.members) ? g.members : [];
}

export function isMember(group: any, phone: string): boolean {
  const uids = Array.isArray(group?.memberUIDs) ? group.memberUIDs : group?.memberUIDs;
  if (Array.isArray(uids)) {
    return uids.map((u: any) => String(u).trim()).includes(phone);
  }
  return memberList(group).some((m: any) => {
    const p = typeof m === "string" ? m : m?.phone || m?.uid || "";
    return String(p).trim() === phone;
  });
}

/** Same-location match (state + district + city). Groups record these fields. */
export function matchesLocation(g: any, state: string, district: string, city: string): boolean {
  return norm(g?.state) === norm(state) && norm(g?.district) === norm(district) && norm(g?.city) === norm(city);
}

/** A group is open for join while its status is an open/pending value. */
export function isOpen(g: any): boolean {
  return OPEN_STATUSES.includes(String(g?.status || "waiting").toLowerCase());
}

/** Effective required size: prefer the group's own, fall back to the map. */
export function resolveRequired(g: any, option: string): number {
  const n = Number(g?.requiredSize);
  if (!Number.isNaN(n) && n >= 2) return n;
  return getRequiredSize(option);
}

/** Member count: prefer authoritative membersCount, fall back to array length. */
export function memberCount(g: any): number {
  if (Number.isFinite(Number(g?.membersCount))) return Number(g.membersCount);
  return memberList(g).length;
}

/**
 * Pick the OLDEST compatible, open, not-full, not-joined group doc.
 * Generic over the doc wrapper so it works against admin query snapshots
 * (which carry `.ref` for transactions) AND plain `{ id, data() }` test
 * harness objects. Any wrapper with `.data()` is accepted.
 */
export interface GroupDoc<T = any> {
  id: string;
  data(): T;
}

export function pickOldestOpen<T extends { data(): any }>(
  docs: T[],
  args: { state: string; district: string; city: string; option: string; phone: string }
): T | null {
  let best: T | null = null;
  let bestKey = Number.MAX_SAFE_INTEGER;

  for (const d of docs) {
    const g = d.data();
    if (!isOpen(g)) continue;
    if (!matchesLocation(g, args.state, args.district, args.city)) continue;
    if (isMember(g, args.phone)) continue;
    if (memberCount(g) >= resolveRequired(g, args.option)) continue;

    let key = Number.MAX_SAFE_INTEGER;
    const c = g?.createdAt as any;
    if (c?.toMillis) key = c.toMillis();
    else if (c?.seconds) key = c.seconds * 1000;
    else if (typeof c === "number") key = c;
    else if (typeof c === "object" && c?._seconds != null) key = c._seconds * 1000;

    if (key < bestKey) {
      bestKey = key;
      best = d;
    }
  }

  return best;
}