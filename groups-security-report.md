# Groups Collection — Security Analysis Report

**Date:** 2026-06-06  
**Analyst:** Automated Rule Review  
**Scope:** `match /groups/{groupId}` collection in `firestore.rules`

---

## Current Rule

```javascript
match /groups/{groupId} {

  allow read: if loggedIn();

  allow create: if
    loggedIn() &&
    request.resource.data.membersCount is int &&
    request.resource.data.requiredSize is int &&
    request.resource.data.members is list &&
    request.resource.data.memberUIDs is list &&
    validString(request.resource.data.category) &&
    validString(request.resource.data.option);

  allow update: if
    loggedIn();                          // <--- TARGET RULE (line 104-105)

  allow delete: if isAdmin();
}
```

---

## Question 1: Can any authenticated user modify any group?

**Answer: YES — unconditionally.**

The rule `allow update: if loggedIn();` grants **full write access to every group document** to any user who has passed Firebase Authentication. There is:

- ❌ No ownership check (e.g., "is this user a member?")
- ❌ No admin override (the `isAdmin()` function exists but is not used here)
- ❌ No field-level validation (unlike the `create` rule which validates types)
- ❌ No constraint on what fields can be changed

A user who is not a member of any group can still modify all of them.

---

## Question 2: What fields can be abused?

### Group document schema (from `app/save/page.tsx`)

```typescript
{
  category: string,          // user-selected category
  option: string,            // user-selected option
  members: Array<object>,    // [{ uid, phone, name, gender, photoURL, paid, ... }]
  memberUIDs: Array<string>, // phone numbers
  membersCount: number,      // length of members
  requiredSize: number,      // max members allowed
  status: string,            // "waiting" | "ready" | "completed"
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastActivityAt: Timestamp,
  createdBy: string,         // phone of creator
  totalPaid: number,         // revenue tracking
  revenue: number,           // revenue tracking
  readyAt?: Timestamp,
}
```

### Abuse surface

| Field | Attack | Severity |
|-------|--------|----------|
| `members` | Inject fake user objects; remove legitimate members; set `paid: true` on fake entries | **CRITICAL** |
| `memberUIDs` | Add/remove any UID arbitrarily | **CRITICAL** |
| `membersCount` | Override to any number — desyncs from actual `members` array | **HIGH** |
| `status` | Advance to `"ready"` or `"completed"` without paying; bypass payment gate | **CRITICAL** |
| `totalPaid` / `revenue` | Inflate financial counters; corrupt admin revenue dashboard | **HIGH** |
| `requiredSize` | Change to 0 (instant complete) or 999 (group never fills) | **MEDIUM** |
| `createdBy` | Impersonate original group creator | **MEDIUM** |
| `category` / `option` | Re-classify a group to a different offering | **LOW** |
| `readyAt` | Falsify group-ready timestamp | **LOW** |

---

## Question 3: What is the smallest possible rule change?

### Constraints — must not break:

| Flow | What it updates on the groups doc | File |
|------|-----------------------------------|------|
| **Save page** → join group | `members` (arrayUnion), `memberUIDs` (arrayUnion), `membersCount`, `updatedAt`, `lastActivityAt`, `status`, `readyAt` | `app/save/page.tsx` |
| **Dashboard** → leave group | `members` (arrayRemove), `memberUIDs` (arrayRemove), `membersCount` | `app/dashboard/page.tsx` |
| **Admin** → mark completed | `status`, `lastActivityAt` | `app/admin/page.tsx` |
| **Payment flow** | Does NOT update groups — only creates/reads `payments` | `app/payment/page.tsx` |
| **Chat flow** | Does NOT update groups — reads group for membership check | `app/chat/[groupId]/page.tsx` |

### Required rule diff

The minimal change uses **field-whitelist validation via `diff()`**: restrict updates to only the fields that the client-side code legitimately modifies. Admin retains full access via `isAdmin()`.

```diff
       allow update: if
-        loggedIn();
+        loggedIn() &&
+        (
+          isAdmin() ||
+          request.resource.data
+            .diff(resource.data)
+            .affectedKeys()
+            .hasOnly([
+              "members",
+              "memberUIDs",
+              "membersCount",
+              "updatedAt",
+              "lastActivityAt",
+              "status",
+              "readyAt"
+            ])
+        );
```

### What this prevents

| Restriction | Effect |
|-------------|--------|
| Blocks `category` changes | Attacker cannot hijack a group's identity |
| Blocks `option` changes | Same as above |
| Blocks `requiredSize` changes | Cannot overflow/underflow group |
| Blocks `createdBy` changes | Cannot impersonate creator |
| Blocks `totalPaid` / `revenue` changes | Cannot fake revenue counters — **admin can only change these via server-side code** |
| Blocks `createdAt` changes | Cannot backdate groups |

### What this still allows (correctly)

| Allowed field | Why it's needed |
|---------------|-----------------|
| `members` | Joining / leaving a group |
| `memberUIDs` | Maintaining the parallel UID list |
| `membersCount` | Keeping count in sync |
| `updatedAt` | Temporal metadata |
| `lastActivityAt` | Temporal metadata |
| `status` | Moving from `waiting` → `ready` → `completed` |
| `readyAt` | Marking when group became ready |

---

## Attack Examples

### Attack 1: Free ride — bypass payment

**Goal:** Mark a group as "ready" without paying.

**Request:**
```
PATCH /groups/{anyGroupId}
{
  "status": "ready",
  "readyAt": Timestamp
}
```

**Current rule:** ✅ Allowed — `loggedIn()` passes.  
**With proposed rule:** ✅ Allowed — `status` and `readyAt` are in the whitelist.

> **Note:** The payment check is NOT enforced by Firestore rules — it is enforced client-side in `dashboard/page.tsx` and `chat/[groupId]/page.tsx` by checking the `payments` collection. This is a **client-side trust gap** that exists independently of this rule change. A dedicated server-side webhook should set `status = "ready"` upon payment verification for true security.

### Attack 2: Revenue inflation

**Goal:** Inflate admin revenue numbers.

**Request:**
```
PATCH /groups/{anyGroupId}
{
  "totalPaid": 999999,
  "revenue": 999999
}
```

**Current rule:** ✅ Allowed — `loggedIn()` passes.  
**With proposed rule:** ❌ **Blocked** — `totalPaid` and `revenue` are not in the whitelist.

### Attack 3: Member injection

**Goal:** Add arbitrary fake members to any group.

**Request:**
```
PATCH /groups/{anyGroupId}
{
  "members": [
    { "uid": "fake999", "phone": "fake999", "name": "Fake User", "paid": true }
  ],
  "memberUIDs": ["fake999"],
  "membersCount": 1
}
```

**Current rule:** ✅ Allowed — `loggedIn()` passes.  
**With proposed rule:** ✅ Still allowed — `members`, `memberUIDs`, `membersCount` are whitelisted.  
**Remaining gap:** No verification that the user adding themselves is actually themselves. Fixing this would require storing Firebase Auth UIDs in `memberUIDs` instead of phone numbers, or adding a `createdBy` check that maps `request.auth.uid` to a phone number — which is a larger refactor.

### Attack 4: Group repurposing

**Goal:** Change an existing "split" group to "car" category.

**Request:**
```
PATCH /groups/{anyGroupId}
{
  "category": "car",
  "option": "car"
}
```

**Current rule:** ✅ Allowed — `loggedIn()` passes.  
**With proposed rule:** ❌ **Blocked** — `category` and `option` are not in the whitelist.

### Attack 5: Denial of service — empty group

**Goal:** Corrupt or empty a group.

**Request:**
```
PATCH /groups/{anyGroupId}
{
  "members": [],
  "memberUIDs": [],
  "membersCount": 0
}
```

**Current rule:** ✅ Allowed — `loggedIn()` passes.  
**With proposed rule:** ✅ Still allowed — whitelisted fields.  
**Mitigation (optional):** Add `request.resource.data.members.size() > 0 || request.resource.data.memberUIDs.size() > 0` but this would break the `deleteMatch` flow when `newCount === 0` (which calls `deleteDoc`, not `updateDoc`).

---

## Risk Assessment

| Dimension | Rating | Explanation |
|-----------|--------|-------------|
| **Impact** | **HIGH** | An attacker can corrupt financial data, bypass group integrity, and inject fraudulent records into any group on the platform |
| **Likelihood** | **MEDIUM** | The vulnerability is trivially exploitable — any authenticated user can craft a Firestore write with any field values using browser dev tools or a script |
| **Detectability** | **LOW** | Most abuse (revenue inflation, fake members, status tampering) leaves no audit trail and blends into normal operations |
| **Overall** | **HIGH** | Unauthenticated (beyond basic auth) write access to a collection that tracks payments and user matching |

### Recommended priority

| Priority | Action |
|----------|--------|
| **P0 — Immediate** | Apply the field whitelist rule diff above 🚨 |
| **P1 — Short-term** | Align `memberUIDs` values with Firebase Auth `uid` so rules can do `request.auth.uid in resource.data.memberUIDs` |
| **P2 — Medium-term** | Move `status = "ready"` writes to the payment webhook handler (server-side), removing client-side trust |
| **P3 — Long-term** | Add `createdBy == request.auth.uid` check on `create` and `delete` rules for consistency |

---

## Summary

| Aspect | Current | Proposed |
|--------|---------|----------|
| Rule | `loggedIn()` | `loggedIn() && (isAdmin() || field-whitelist)` |
| Auth check | Any user | Any user, but field-restricted |
| Field abuse | All fields | Only `members`, `memberUIDs`, `membersCount`, `updatedAt`, `lastActivityAt`, `status`, `readyAt` |
| Admin override | Not included | Included via `isAdmin()` |
| Lines changed | — | +11 (indent + 10 new) |
| Flows broken | — | Zero — all four flows (save, dashboard, payment, chat) only touch whitelisted fields |

**Bottom line:** The current rule is a single-line `loggedIn()` check that leaves every group document wide open to any authenticated user. The proposed 10-line addition constrains updates to only the fields the application actually needs, while preserving full admin access and breaking zero existing flows.