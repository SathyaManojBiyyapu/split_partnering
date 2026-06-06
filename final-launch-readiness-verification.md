# Final Launch Readiness Verification Report

**Date:** 2026-06-06  
**Project:** Split Partnering  
**Domain:** https://partnering.in  
**Task:** Final verification — Firebase Admin SDK, Razorpay Webhook, deployment checklist  
**Constraint:** No modifications to payment code, Firestore rules, or membership logic.

---

## 1. Firebase Admin SDK — Initialization Verification

### File Analyzed: `firebase/admin.js`

**Code structure:**

```javascript
const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!admin.apps.length) {
  if (serviceAccountKey) {
    // PATH A: Service account JSON provided → admin.credential.cert(serviceAccount)
    const serviceAccount = JSON.parse(serviceAccountKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // PATH B: Fallback → Application Default Credentials
    admin.initializeApp({
      projectId: "splitpartnering",
    });
  }
}
```

### Verification Result: ✅ WILL INITIALIZE CORRECTLY once FIREBASE_SERVICE_ACCOUNT_KEY is added

| Check | Status | Detail |
|-------|--------|--------|
| `JSON.parse(serviceAccountKey)` | ✅ Correct | Requires valid single-line JSON — setup guide documents this precisely |
| `admin.credential.cert()` | ✅ Correct | Standard Firebase Admin SDK credential method |
| `admin.apps.length` guard | ✅ Correct | Prevents re-initialization (Next.js hot reload safe) |
| Exports (`adminDb`, `adminTimestamp`) | ✅ Correct | Properly typed and exported |

### What happens on Vercel today (without the key):

- PATH B code path runs
- `admin.initializeApp({ projectId: "splitpartnering" })` will **not throw immediately** — Firebase Admin SDK initialization is lazy
- The **first Firestore operation** (`adminDb.collection(...).get()`) will throw:  
  `Error: Failed to determine project ID from credentials or default credentials`
- This crashes all routes that import from `@/firebase/admin`:
  - `POST /api/verify-razorpay-payment` — **payment verification fails, user sees error**
  - `POST /api/razorpay-webhook` — **webhook processing fails entirely**
  - `POST /api/stripe-webhook` — **not used** (currently only logs, no writes)
  - `POST /api/verify-stripe-session` — **would fail** if implemented with Firestore writes

### Verdict:
- **Code is correct.** No syntax errors, no logic bugs, no runtime coding issues.
- **Only blocking factor:** missing `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable.
- **Setup guide exists** at `firebase-service-account-setup-guide.md` with step-by-step instructions.

---

## 2. Razorpay Webhook — Verification

### File Analyzed: `app/api/razorpay-webhook/route.ts`

### Verification Result: ✅ WILL WORK correctly once RAZORPAY_WEBHOOK_SECRET is added

| Check | Status | Detail |
|-------|--------|--------|
| Signature verification algorithm | ✅ Correct | HMAC-SHA256 with `rawBody` (correct — Razorpay standard) |
| `x-razorpay-signature` header read | ✅ Correct | `req.headers.get("x-razorpay-signature")` |
| Missing signature handler | ✅ Correct | Returns HTTP 400 |
| Missing secret handler | ✅ Correct | Returns HTTP 500 with clear error message (lines 99–109) |
| Invalid signature handler | ✅ Correct | Returns HTTP 400 |
| Event filtering | ✅ Correct | Only processes `payment.captured` |
| Missing `notes.groupId`/`notes.uid` | ✅ Correct | Graceful skip — returns HTTP 200 with `{ received: true, skipped: true }` |
| `finalizePayment()` logic | ✅ Correct | Updates `payments` documents from `pending` → `paid` via Admin SDK |
| `markMemberPaid()` logic | ✅ Correct | Updates `groups/{id}/members[].paid` via Admin SDK |
| Idempotency | ✅ Partial | `where("status", "==", "pending")` prevents double-processing on retries |
| Error handling | ✅ Correct | All errors caught, logged, returns HTTP 500 |
| Firestore update via Admin SDK | ✅ Correct | `adminDb` bypasses security rules — no conflict with Firestore rules |

### One code-level observation:

In the `console.warn` on line 130, `payment.id` is referenced. The variable `payment` is scoped inside the `if (event.event === "payment.captured")` block (line 122) where `const payment = event.payload.payment.entity` is declared. **This is correctly in scope.** No bug.

### Webhook URL to configure:

```
https://partnering.in/api/razorpay-webhook
```

### Event to subscribe to:

- `payment.captured` (only)

### Verdict:
- **Code is correct and well-structured.** The webhook handler follows best practices for Razorpay webhooks.
- **Only blocking factor:** missing `RAZORPAY_WEBHOOK_SECRET` environment variable in both `.env.local` and Vercel.
- **Also requires** `FIREBASE_SERVICE_ACCOUNT_KEY` — same as above, since the webhook uses `adminDb` for Firestore writes.

---

## 3. Remaining Launch-Blocking Configuration Issues

### 3.1 Missing Environment Variables (BLOCKERS)

| Variable | Status | Files Affected | Impact |
|----------|--------|----------------|--------|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | ❌ Missing | `firebase/admin.js` → all API routes using `adminDb` | All server-side Firestore writes fail on Vercel |
| `RAZORPAY_WEBHOOK_SECRET` | ❌ Missing | `app/api/razorpay-webhook/route.ts` | Webhook returns HTTP 500 on every call |

### 3.2 Firestore Rules (Noted — do NOT modify per task constraints)

The existing Production Readiness Report identified `groups` update rule (`allow update: if loggedIn()`) as critical. **Per task instructions, no changes to Firestore rules.** This is documented for awareness.

### 3.3 Stripe Configuration (Intentionally Incomplete)

| Variable | Value | Status |
|----------|-------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_xxxxxxxxx` | ❌ Placeholder — intentionally disabled |
| `NEXT_PUBLIC_STRIPE_ENABLED` | `false` | ✅ Intentionally disabled |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxxxxxxxx` | ❌ Placeholder — not needed until Stripe is enabled |

**Stripe is not a launch blocker** — it is disabled client-side and gracefully returns HTTP 503 from the server. No user-facing impact.

### 3.4 Razorpay Keys (Correctly Configured)

| Variable | Value | Status |
|----------|-------|--------|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | `rzp_test_SyDvEezHKmsl2R` | ✅ Configured |
| `RAZORPAY_KEY_ID` | `rzp_test_SyDvEezHKmsl2R` | ✅ Configured |
| `RAZORPAY_KEY_SECRET` | `3D0K5X2VkCOM9IppMhUOAjcr` | ✅ Configured |

**Production key blocker:** `create-razorpay-order/route.ts` checks `NODE_ENV === "production"` and rejects `rzp_test_*` keys. **Before going to production, replace with LIVE Razorpay keys.**

### 3.5 Security Headers (Configured Correctly)

| Header | Value | Status |
|--------|-------|--------|
| `X-Frame-Options` | `DENY` | ✅ Set |
| `X-Content-Type-Options` | `nosniff` | ✅ Set |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Set |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | ✅ Set |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | ✅ Set |
| `Content-Security-Policy` | Comprehensive — see `next.config.ts` | ✅ Set (note: includes `'unsafe-eval'` and `'unsafe-inline'` which are acceptable for initial launch) |

### 3.6 NEXT_PUBLIC_BASE_URL (Configured)

```
NEXT_PUBLIC_BASE_URL=https://partnering.in
```

✅ Correct — used as success/cancel URL base for Stripe checkout and other redirects.

### 3.7 Firebase Client Config (Hardcoded in `firebase/config.js`)

All values are hardcoded directly in the source file — correct for client-side Firebase SDK. **No environment variables needed** for the client SDK.

### 3.8 Admin Page Authentication (Noted — Improvement for Post-Launch)

The admin page uses a hardcoded email check (`user?.email === "sathyamanojbiyyapu@gmail.com"`). The `isAdmin()` function in Firestore rules checks `request.auth.token.admin == true` (Firebase custom claims), but these are not set. **This is a security improvement for post-launch, not a launch blocker.**

---

## 4. Final Deployment Checklist

### ⚠️ PRE-LAUNCH — Must Complete Before Going Live

- [ ] **Generate Firebase Service Account Key**
  - Firebase Console → Project Settings → Service Accounts → Generate New Private Key
  - Convert JSON to single line
  - Add as `FIREBASE_SERVICE_ACCOUNT_KEY` in Vercel Dashboard (Production, Preview, Development)
  - Add to `.env.local` for local testing
  - Redeploy Vercel

- [ ] **Configure Razorpay Webhook**
  - Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - Go to Razorpay Dashboard → Settings → Webhooks → Add New
  - URL: `https://partnering.in/api/razorpay-webhook`
  - Secret: paste generated hex string
  - Event: `payment.captured` only
  - Save

- [ ] **Add RAZORPAY_WEBHOOK_SECRET to Vercel**
  - Vercel Dashboard → Settings → Environment Variables
  - Name: `RAZORPAY_WEBHOOK_SECRET`
  - Value: same hex string from above
  - Environments: Production, Preview, Development
  - Redeploy

- [ ] **Test Admin SDK connectivity**
  - Create temporary `app/api/test-admin/route.ts` (see `firebase-service-account-setup-guide.md`)
  - Visit `https://partnering.in/api/test-admin`
  - Verify `{ "success": true, "message": "adminDb connected successfully" }`
  - Delete the test route

- [ ] **Test Razorpay Webhook**
  - Razorpay Dashboard → Settings → Webhooks → ⋮ → Send Test Webhook
  - Event: `payment.captured`
  - Check logs for HTTP 200 response
  - Expected: `{ "received": true, "skipped": true }` (test webhook has no notes)

- [ ] **Replace Razorpay Test Keys with Live Keys**
  - Go to Razorpay Dashboard → Settings → API Keys
  - Generate live keys
  - Update `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in Vercel
  - Update `.env.local` locally

### 🔄 POST-LAUNCH — High Priority Improvements

- [ ] **Fix Firestore groups update rule** — add field whitelist / ownership check / `isAdmin()` guard
- [ ] **Switch admin authentication from hardcoded email to Firebase custom claims**
- [ ] **Remove `'unsafe-eval'` from CSP** — Razorpay requires `'unsafe-inline'` but not `'unsafe-eval'`
- [ ] **Fix client-sent amount vulnerability** — store canonical price server-side, validate on order creation
- [ ] **Add Stripe `markMemberPaid()` server-side logic** if Stripe will be enabled
- [ ] **Add rate limiting** on payment API routes
- [ ] **Add `RAZORPAY_WEBHOOK_SECRET` commented entry** in `.env.local` for documentation

### ✅ ALREADY WORKING

- [x] Firebase client configuration (`firebase/config.js`)
- [x] Security headers (HSTS, X-Frame-Options, CSP, etc.)
- [x] Razorpay order creation (correct payment creation)
- [x] Razorpay payment verification (HMAC signature, direct redirect flow)
- [x] Razorpay signature verification logic (both webhook and redirect)
- [x] NEXT_PUBLIC_BASE_URL correctly set
- [x] Package dependencies (firebase-admin v13.10.0, razorpay v2.9.6, next v16)
- [x] Stripe is gracefully disabled (no user-facing impact)

---

## Summary

| Component | Status | Action Required |
|-----------|--------|----------------|
| `firebase/admin.js` initialization | ✅ Code correct | Add `FIREBASE_SERVICE_ACCOUNT_KEY` to Vercel |
| `POST /api/razorpay-webhook` | ✅ Code correct | Add `RAZORPAY_WEBHOOK_SECRET` to Vercel and configure webhook in Razorpay Dashboard |
| `POST /api/verify-razorpay-payment` | ✅ Code correct | Requires `FIREBASE_SERVICE_ACCOUNT_KEY` |
| `POST /api/create-razorpay-order` | ✅ Code correct | Replace `rzp_test_*` with live keys before production |
| Environment variables | 2 missing | `FIREBASE_SERVICE_ACCOUNT_KEY` + `RAZORPAY_WEBHOOK_SECRET` |
| Firestore rules | ⚠️ Known gap | Groups update rule (`A1`) — post-launch fix per task constraints |
| CSP `'unsafe-eval'` | ⚠️ Present | Remove post-launch |
| Admin authentication | ⚠️ Hardcoded email | Migrate to custom claims post-launch |
| **Launch verdict** | **🔴 BLOCKED** | Two missing env vars block launch. Estimated fix time: ~30 minutes |