# Group Membership Flow — Security Analysis

**Date:** 2026-06-06  
**Scope:** `match /groups/{groupId}` — membership operations  
**Files analyzed:** `app/save/page.tsx`, `app/dashboard/page.tsx`, `app/admin/page.tsx`, `firestore.rules`

---

## 1. How Users Join Groups

**File:** `app/save/page.tsx`, lines 111–501, function `createOrJoinGroup()`

### Step-by-step flow

```
User clicks "Make Partner" button
         │
         ▼
Read phone from localStorage.getItem("phone")   ← plain phone string, e.g. "9876543210"
         │
         ▼
Build memberObject:
  {
    uid:        cleanPhone,      // ← "9876543210" (phone)
    phone:      cleanPhone,      // ← "9876543210" (phone)
    maskedPhone: maskPhone(...), // ← "xxxxx43210"
    name:       userData.name || displayName,
    gender:     userData.gender || "",
    photoURL:   userData.photoURL || "",
    joinedAt:   new Date(),
    online:     true,
    paid:       false,
  }
         │
         ▼
Query groups WHERE category==X AND option==Y
         │
         ▼
For each matching group with open slot:
  updateDoc(gRef, {
    members:     arrayUnion(memberObject),   // ← full object with phone
    memberUIDs:  arrayUnion(cleanPhone),     // ← "9876543210" (plain phone)
    membersCount: updatedCount,
    updatedAt:   serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    status:      updatedCount >= required ? "ready" : "waiting",
  })
```

### Key observations

| Aspect | Detail |
|--------|--------|
| **Identity used** | `cleanPhone` — a raw phone string from localStorage |
| **Firebase Auth used?** | Only as a gate (`auth.currentUser != null` check), not as an identifier |
| **`request.auth.uid` in rules** | Is a Firebase Auth UID (e.g., `abc123...`), NOT the phone number |
| **Member dedup** | Done client-side by scanning `members[].phone` |
| **Who can join** | Client decides based on localStorage phone |

---

## 2. How Users Leave Groups

**File:** `app/dashboard/page.tsx`, lines 315–430, function `deleteMatch()`

### Step-by-step flow

```
User clicks "Remove Match" button
         │
         ▼
Read phone from localStorage.getItem("phone")
         │
         ▼
Find member object in group.members[] where m.phone === phone
         │
         ▼
updateDoc(gRef, {
  members:     arrayRemove(foundMember),   // ← removes the matched object
  memberUIDs:  arrayRemove(phone),         // ← removes "9876543210"
  membersCount: newCount - 1,
})
         │
         ▼
If newCount === 0 → deleteDoc(gRef)       // ← delete entire group doc
```

### Key observations

| Aspect | Detail |
|--------|--------|
| **Identity used** | `phone` from localStorage |
| **Who can remove** | Any user who knows the group ID and a phone that matches a member |
| **Group deletion** | If last member leaves, whole group is deleted (not just emptied) |
| **Admin deletion** | Separate function in admin page (`deleteGroup`, line 568) — uses `deleteDoc` directly |

---

## 3. How `memberUIDs` Is Populated

### Current schema

```typescript
// As written in save/page.tsx lines 460-462
memberUIDs: [cleanPhone]   // e.g. ["9876543210"]
```

### Content analysis

| Question | Answer |
|----------|--------|
| Phone numbers? | **YES** — always, e.g. `["9876543210", "9988776655"]` |
| Firebase Auth UIDs? | **NO** — never stored |
| Both? | **NO** — phone numbers only |

**Root cause:** The `uid` field inside each `memberObject` is also set to `cleanPhone` (the phone number), NOT the Firebase Auth UID:

```typescript
// save/page.tsx line 176-177
uid: cleanPhone,     // ← phone number, not Firebase Auth UID
```

---

## 4. Can Groups Be Secured So Users May Only Add/Remove Themselves?

### The fundamental problem

| What the app uses | What `request.auth` has |
|-------------------|------------------------|
| `"9876543210"` (phone) | `"abc123def456..."` (Firebase Auth UID) |

These are **different values**. The Firestore rule `request.auth.uid in resource.data.memberUIDs` would **never match** because:

- `request.auth.uid` = `"abc123def456..."` (Firebase Auth generated UID)
- `resource.data.memberUIDs` = `["9876543210", "9988776655"]` (phone numbers)

### Solution approach

Add a `authUID` field to the group document schema that maps `request.auth.uid` → each phone-based member entry.

---

## Proposed Schema Change

### Current `memberObject` (no change needed in `members` array)

```typescript
memberObject = {
  uid:        "9876543210",    // ← phone (keep for backward compat)
  phone:      "9876543210",    // ← phone
  authUID:    "abc123...",     // ← NEW: Firebase Auth UID from auth.currentUser.uid
  name:       "User",
  gender:     "",
  photoURL:   "",
  joinedAt:   Timestamp,
  online:     true,
  paid:       false,
}
```

### New field: `memberAuthUIDs` array

```typescript
// On the group document (alongside existing fields)
memberAuthUIDs: ["abc123...", "def456..."],   // ← NEW: Firebase Auth UIDs only
```

### Existing fields remain unchanged (backward compatible)

```typescript
members:     [{ uid: "9876543210", phone: "9876543210", authUID: "abc123...", ... }]
memberUIDs:  ["9876543210", "9988776655"]       // ← unchanged, phone-based
```

---

## Proposed Firestore Rule

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
    loggedIn() &&
    (
      isAdmin() ||

      // Self-add: user is adding themselves to the group
      (
        // Only whitelisted fields may change
        request.resource.data
          .diff(resource.data)
          .affectedKeys()
          .hasOnly([
            "members",
            "memberUIDs",
            "memberAuthUIDs",       // ← NEW
            "membersCount",
            "updatedAt",
            "lastActivityAt",
            "status",
            "readyAt"
          ]) &&

        // The user's Auth UID must appear in memberAuthUIDs (they added themselves)
        request.auth.uid in request.resource.data.memberAuthUIDs &&

        // The user's Auth UID was NOT in the previous memberAuthUIDs (it's a new add)
        !(request.auth.uid in resource.data.memberAuthUIDs) &&

        // membersCount only increased by 1
        request.resource.data.membersCount == resource.data.membersCount + 1 &&

        // memberAuthUIDs only grew by 1 (the current user)
        request.resource.data.memberAuthUIDs.size() ==
          resource.data.memberAuthUIDs.size() + 1

      ) ||

      // Self-remove: user is removing themselves
      (
        request.resource.data
          .diff(resource.data)
          .affectedKeys()
          .hasOnly([
            "members",
            "memberUIDs",
            "memberAuthUIDs",       // ← NEW
            "membersCount",
            "updatedAt",
            "lastActivityAt"
          ]) &&

        // The user's Auth UID was in the previous memberAuthUIDs
        request.auth.uid in resource.data.memberAuthUIDs &&

        // The user's Auth UID is NOT in the new memberAuthUIDs (they removed themselves)
        !(request.auth.uid in request.resource.data.memberAuthUIDs) &&

        // membersCount only decreased by 1
        request.resource.data.membersCount == resource.data.membersCount - 1 &&

        // memberAuthUIDs only shrank by 1 (the current user)
        request.resource.data.memberAuthUIDs.size() ==
          resource.data.memberAuthUIDs.size() - 1

      )
    );

  allow delete: if isAdmin();
}
```

---

## Required Client-Side Code Changes

### 1. `app/save/page.tsx` — Join group (lines 289–318)

**Current:**
```typescript
await updateDoc(gRef, {
  members:     arrayUnion(memberObject),
  memberUIDs:  arrayUnion(cleanPhone),
  membersCount: updatedCount,
  updatedAt:   serverTimestamp(),
  lastActivityAt: serverTimestamp(),
  status:      updatedCount >= required ? "ready" : "waiting",
});
```

**Change:**
```typescript
await updateDoc(gRef, {
  members:         arrayUnion(memberObject),        // ← add authUID field to memberObject
  memberUIDs:      arrayUnion(cleanPhone),
  memberAuthUIDs:  arrayUnion(auth.currentUser.uid), // ← NEW
  membersCount:    updatedCount,
  updatedAt:       serverTimestamp(),
  lastActivityAt:  serverTimestamp(),
  status:          updatedCount >= required ? "ready" : "waiting",
});
```

Also add `authUID: auth.currentUser.uid` to `memberObject` definition.

### 2. `app/dashboard/page.tsx` — Leave group (lines 387–404)

**Current:**
```typescript
await updateDoc(gRef, {
  members:     arrayRemove(removeMember),
  memberUIDs:  arrayRemove(phone),
  membersCount: newCount,
});
```

**Change:**
```typescript
await updateDoc(gRef, {
  members:         arrayRemove(removeMember),
  memberUIDs:      arrayRemove(phone),
  memberAuthUIDs:  arrayRemove(firebaseAuthUID),      // ← NEW
  membersCount:    newCount,
});
```

Where `firebaseAuthUID` would need to be passed to `deleteMatch()` or fetched from auth context. Note that `deleteMatch()` in dashboard currently does NOT have access to `auth.currentUser.uid` — it only uses `phone` from localStorage. This would need to be added.

### 3. `app/admin/page.tsx` — Admin mark completed (line 534)

**No change needed** — admin uses `isAdmin()` path which bypasses all membership checks.

---

## Migration Complexity

| Dimension | Rating | Notes |
|-----------|--------|-------|
| **Schema change** | **LOW** | Add `authUID` field to `memberObject`; add `memberAuthUIDs` array to group doc |
| **Backward compatibility** | **MEDIUM** | Existing groups lack `memberAuthUIDs` — rule must handle `resource.data.memberAuthUIDs` being undefined (falsy `in` check returns false, so existing groups lock until admin migrates) |
| **Client-side changes** | **MEDIUM** | 2 files modified: `save/page.tsx` (join) and `dashboard/page.tsx` (leave) |
| **Firestore rule complexity** | **HIGH** | The rule is long and has multiple branches. Firestore `diff()` + size comparisons are powerful but harder to debug |
| **Logic for self-join** | **MEDIUM** | Need to ensure rule allows first member to join an empty group (`resource.data` might not exist on first write? No — it's an update, so `resource.data` is the current state) |
| **Testing burden** | **HIGH** | Every edge case (first member, last member leaving, admin updating, concurrent joins) must be tested |

### Estimated migration effort: 2–4 hours for a production deployment

---

## Risk Assessment of Proposed Solution

| Risk | Level | Mitigation |
|------|-------|------------|
| **Locked groups** — existing groups without `memberAuthUIDs` cannot be updated by non-admins | **HIGH** | Run a one-time migration script to populate `memberAuthUIDs` on all existing groups using `authUID` from each `memberObject`, or set `memberAuthUIDs = []` and exempt empty arrays from the rule |
| **Concurrent join race condition** — two users join at the same time and both pass the `size() == old + 1` check before either write completes | **MEDIUM** | Firestore transactions handle this at the document level; the app currently uses simple `updateDoc` calls. Would need to switch to `runTransaction()` for joins |
| **Admin account compromise** — if admin account is stolen, all groups are compromised | **LOW** | Same risk exists today; mitigated by Google account MFA |
| **Firestore rules complexity** — complex rules are harder to audit and more likely to have logic bugs | **MEDIUM** | Add unit tests using Firestore emulator before deploying |
| **`lastActivityAt` field abuse** — user could spam writes to this field (still in whitelist) | **LOW** | Acceptable — it's a timestamp; no security impact |

---

## Summary

### Current state

| Property | Value |
|----------|-------|
| Who can join? | Any authenticated user, any group |
| Who can leave? | Any authenticated user, any group |
| memberUIDs contain | Phone numbers only |
| Can rules verify identity? | **No** — `request.auth.uid` (Auth UID) ≠ phone numbers in memberUIDs |

### After proposed change

| Property | Value |
|----------|-------|
| Who can join? | Any authenticated user, **but only by adding themselves** |
| Who can leave? | **Only themselves** (cannot remove other members) |
| memberAuthUIDs contain | Firebase Auth UIDs |
| Can rules verify identity? | **Yes** — `request.auth.uid` matched against `memberAuthUIDs` |
| Admin override? | Yes — `isAdmin()` bypasses all checks |

### Bottom line

The current architecture uses **phone numbers as user identifiers** while Firestore rules expose **Firebase Auth UIDs**. These are incompatible. Adding a `memberAuthUIDs` array that stores Firebase Auth UIDs bridges this gap, enabling rules to verify that `request.auth.uid` (the caller) is in fact the member being added or removed. The migration is moderate complexity (~2–4 hours) but closes the highest-severity remaining gap after the field-whitelist rule.