# Production Readiness Report

**Date:** 2026-06-06  
**Project:** Split Partnering  
**Domain:** https://partnering.in  
**Review Scope:** Razorpay flow, Firestore rules, Admin access, Firebase config, Vercel env, Security headers, Production deployment

---

## SECTION A — Launch Blockers

### A1. Firestore Rules — Groups Update (CRITICAL)

| Property | Value |
|----------|-------|
| **File** | `firestore.rules`, lines 104–105 |
| **Rule** | `allow update: if loggedIn();` |
| **Risk** | Any authenticated user can modify **any field on any group document** |
| **Impact** | Revenue inflation, fake member injection, status tampering, group hijacking |

**Current code:**
```javascript
allow update: if
  loggedIn();
```

**Attack examples:**
- `PATCH /groups/{anyId} { "totalPaid": 999999, "revenue": 999999 }` → inflate revenue
- `PATCH /groups/{anyId} { "status": "completed" }` → bypass payment gate
- `PATCH /groups/{anyId} { "requiredSize": 0 }` → instant group completion
- `PATCH /groups/{anyId} { "members": [fake_user], "memberUIDs": ["fake"], "membersCount": 1 }` → inject fraudulent members

**Why it's a blocker:** There is no field whitelist, no ownership check, and no admin bypass. The `create` rule has type validation but the `update` rule has zero constraints. The `isAdmin()` function exists in the rules file but is not used here.

---

### A2. Razorpay Webhook Secret Not Configured (HIGH)

| Property | Value |
|----------|-------|
| **File** | `.env.local` / `app/api/razorpay-webhook/route.ts` |
| **Missing env var** | `RAZORPAY_WEBHOOK_SECRET` |
| **Status** | Not present in `.env.local` |

**Impact:** The Razorpay webhook handler (`razorpay-webhook/route.ts`) returns HTTP 500 on every call because `RAZORPAY_WEBHOOK_SECRET` is undefined. This means:
- The `payment.captured` event is never processed server-side
- `finalizePayment()` — which updates `payments` from pending → paid via Admin SDK — never runs
- `markMemberPaid()` — which updates `groups/{id}/members[].paid` via Admin SDK — never runs

The `verify-razorpay-payment` endpoint handles the direct redirect flow correctly (Admin SDK writes), but the webhook is the idempotent fallback for async notifications. Without it, any payment notification from Razorpay that arrives outside the browser redirect is lost.

---

### A3. Firebase Service Account Key Not Configured (HIGH)

| Property | Value |
|----------|-------|
| **File** | `firebase/admin.js` |
| **Missing env var** | `FIREBASE_SERVICE_ACCOUNT_KEY` |
| **Status** | Not present in `.env.local` |

**Issue:** `firebase/admin.js` reads `FIREBASE_SERVICE_ACCOUNT_KEY` for Admin SDK initialization. Without it, the fallback uses `admin.initializeApp({ projectId: "splitpartnering" })` which relies on Google Cloud default credentials.

**Why it's a blocker on Vercel:** Vercel does **not** provide Google Cloud default credentials. The Admin SDK will fail to authenticate when deployed on Vercel. All server-side API routes that use `adminDb` (`verify-razorpay-payment`, `razorpay-webhook`, `verify-stripe-session`, `stripe-webhook`) will throw authentication errors.

**Fix:** Generate a service account key from Firebase Console → Project Settings → Service Accounts → Generate New Private Key. Add the entire JSON as a single-line environment variable `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel dashboard and `.env.local`.

---

## SECTION B — High-Priority Fixes

### B1. Admin Authentication is a Hardcoded Email Check

| Property | Value |
|----------|-------|
| **File** | `app/admin/page.tsx`, lines 128–130 |
| **Code** | `user?.email === "sathyamanojbiyyapu@gmail.com"` |

**Issues:**
1. **Hardcoded** — changing the admin email requires a code redeploy
2. **Not using `isAdmin()` in Firestore rules** — the rules function `isAdmin()` checks `request.auth.token.admin == true` (Firebase custom claims), but the admin page does not set or check custom claims
3. **Client-side check** — a modified client build could bypass the check entirely

**Recommendation:** Set Firebase Auth custom claim `admin: true` on the admin user via Admin SDK. Update the admin page to verify `getIdTokenResult().claims.admin === true`. The `isAdmin()` rule function already exists in `firestore.rules` and works correctly with custom claims — it's just not used by the admin page.

---

### B2. CSP Uses `'unsafe-eval'` and `'unsafe-inline'`

| Property | Value |
|----------|-------|
| **File** | `next.config.ts`, lines 32–33 |
| **Directive** | `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com ...` |

**Issue:** `'unsafe-eval'` permits `eval()` and similar functions. `'unsafe-inline'` permits any inline `<script>` tag. Both weaken XSS protection.

**Context:** Razorpay's checkout SDK requires inline scripts. However, `'unsafe-eval'` is not required by Razorpay — it should be removed. `'unsafe-inline'` could be replaced with a nonce or hash-based approach for non-Razorpay pages.

**Recommendation:** Remove `'unsafe-eval'` immediately. Replace `'unsafe-inline'` with a nonce-based CSP using Next.js middleware after launch.

---

### B3. Hardcoded Price of ₹29 (Client-Sent Amount)

| Property | Value |
|----------|-------|
| **Files** | `app/payment/page.tsx` (line 106), `app/api/create-razorpay-order/route.ts` |
| **Risk** | LOW-MEDIUM |

**Issue:** The frontend sends `amount: 29` in the POST body to `/api/create-razorpay-order` and `/api/create-checkout-session`. The server validates `amount >= 1` but accepts whatever the client provides. A malicious user could modify the request to pay ₹1 instead of ₹29.

**Recommendation:** Store the canonical price in a server-side environment variable or Firestore config document. The server should reject amounts that don't match the canonical price, not just validate a minimum.

---

## SECTION C — Medium-Priority Fixes

### C1. No Server-Side Group Member Update for Stripe

| Property | Value |
|----------|-------|
| **Files** | `app/payment-success/page.tsx`, `app/api/verify-stripe-session/route.ts`, `app/api/stripe-webhook/route.ts` |

**Issue:** The Razorpay flow correctly updates `groups/{id}/members[].paid` server-side in `verify-razorpay-payment/route.ts`. The Stripe flow does not do this anywhere:
- `payment-success/page.tsx` updates `payments` collection client-side (trust gap)
- `verify-stripe-session/route.ts` only verifies the session exists and returns success
- `stripe-webhook/route.ts` only logs the event

**Recommendation:** Move Stripe payment finalization to server-side, same pattern as Razorpay. Add `markMemberPaid()` calls to `verify-stripe-session/route.ts` and `stripe-webhook/route.ts`.

---

### C2. No Rate Limiting on Payment API Routes

| Property | Value |
|----------|-------|
| **Files** | All `/api/*` routes |

**Issue:** There is no rate limiting on any API endpoint. An attacker can create unlimited Razorpay orders, hit verification endpoints, and trigger webhooks without throttling.

**Recommendation:** Add rate limiting via Vercel Edge Middleware or `@upstash/ratelimit`.

---

### C3. `isAdmin()` Function Exists in Rules But Not Used Consistently

| Property | Value |
|----------|-------|
| **File** | `firestore.rules` |

**Current usage of `isAdmin()`:**
| Collection | Uses `isAdmin()`? |
|-----------|-------------------|
| `categories` | ✅ Yes |
| `groups` (delete) | ✅ Yes |
| `groups` (update) | ❌ No — uses `loggedIn()` |
| `payments` (update) | ✅ Yes |
| `movieTickets` (update) | ✅ Yes |
| `ticketRequests` (read, update) | ✅ Yes |

The `isAdmin()` function is well-structured (`request.auth.token.admin == true`) and used in most administrative operations. The groups update rule is the notable exception.

---

## SECTION D — Low-Priority Fixes

### D1. Stripe Keys are Placeholder / Disabled

| Property | Value |
|----------|-------|
| **File** | `.env.local` |
| **Values** | `STRIPE_SECRET_KEY=sk_test_xxxxxxxxx`, `NEXT_PUBLIC_STRIPE_ENABLED=false` |

Stripe is intentionally disabled in production. If Razorpay is the sole payment provider, consider removing Stripe code entirely to reduce attack surface. If Stripe is planned for the future, this is acceptable as-is.

---

### D2. Razorpay Webhook Secret Documentation Missing

| Property | Value |
|----------|-------|
| **File** | `.env.local` |

No commented entry exists for `RAZORPAY_WEBHOOK_SECRET`. Add for documentation purposes.

---

### D3. No Payment-Complete Group Status Transition

There is no server-side trigger that transitions `status` to `"ready"` or `"completed"` when all group members have paid. Currently, `status = "ready"` is set client-side when enough members join. Consider adding this to the webhook handler post-launch.

---

### D4. `RAZORPAY_KEY_ID` Defined Twice in `.env.local`

Lines 10 and 13 both define Razorpay Key ID values (one with `NEXT_PUBLIC_` prefix for client access, one without for server). This is intentional and works correctly — noted for future cleanup to avoid confusion.

---

## SECTION E — Production Readiness Score

### Scoring by Category

| Category | Score | /10 | Notes |
|----------|-------|-----|-------|
| **Razorpay — Order API** | 8 | /10 | Server validates amount ≥ 1; blocks `rzp_test_` in production; creates order correctly |
| **Razorpay — Verification** | 9 | /10 | HMAC SHA256 signature verified server-side; Admin SDK updates both `payments` and `groups` |
| **Razorpay — Webhook** | 3 | /10 | Well-structured code but `RAZORPAY_WEBHOOK_SECRET` missing — webhook is non-functional |
| **Firestore Rules** | 3 | /10 | All collections except `groups` are reasonable; groups update is wide open |
| **Admin Access** | 3 | /10 | Hardcoded email check; not using Firebase custom claims; `isAdmin()` exists in rules but unused by admin page |
| **Firebase Config** | 5 | /10 | Client config is correct; Admin SDK will fail on Vercel without service account key |
| **Vercel Env Variables** | 4 | /10 | Razorpay keys present; `FIREBASE_SERVICE_ACCOUNT_KEY` missing; `RAZORPAY_WEBHOOK_SECRET` missing |
| **Security Headers** | 8 | /10 | HSTS, XFO, X-Content-Type-Options, Referrer-Policy all set; CSP needs `'unsafe-eval'` removed |
| **Production Deployment** | 6 | /10 | Vercel-compatible; Admin SDK fallback won't authenticate on Vercel |

### Weighted Readiness Score: **4.9 / 10**

---

## SECTION F — Final Verdict

### ❌ NOT READY

**Three critical issues must be resolved before launch:**

| # | Issue | Severity | Why It Blocks Launch |
|---|-------|----------|---------------------|
| A1 | Groups update rule: `allow update: if loggedIn()` | **CRITICAL** | Any authenticated user can corrupt every group document on the platform — revenue, members, status all unprotected |
| A2 | `RAZORPAY_WEBHOOK_SECRET` not configured | **HIGH** | Razorpay webhook returns 500 on every call; async payment notifications are lost |
| A3 | `FIREBASE_SERVICE_ACCOUNT_KEY` not configured | **HIGH** | Admin SDK will fail on Vercel; all server-side payment verification and group updates break |

**What is working correctly:**

| Component | Status |
|-----------|--------|
| ✅ Razorpay order creation | Correctly creates orders, validates amount, blocks test keys in production |
| ✅ Razorpay signature verification | HMAC SHA256 verified server-side with correct constant-time comparison |
| ✅ Razorpay verification endpoint | Updates both `payments` (status → paid) and `groups` (member.paid → true) via Admin SDK |
| ✅ Firestore rules for `users`, `payments`, `chats`, `selections`, `categories` | All have appropriate access controls |
| ✅ `isAdmin()` function in rules | Well-structured, checks `request.auth.token.admin`, used on 5 of 6 admin operations |
| ✅ Security headers | HSTS (2 years + preload), X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| ✅ Production key detection | `create-razorpay-order` blocks `rzp_test_*` keys in production with clear error message |
| ✅ Firebase client config | Correct project ID, auth domain, and API key configured |
| ✅ CSP allows Razorpay checkout | `https://checkout.razorpay.com` whitelisted in script-src and frame-src |

**Estimated time to fix blockers:** ~2 hours  
**Estimated time to fix all high-priority items:** ~4 hours  
**Readiness score after fixes:** ~7.5–8.0 / 10 → **Launch with Caution**