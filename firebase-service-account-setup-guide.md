# FIREBASE_SERVICE_ACCOUNT_KEY — Setup Guide

**Date:** 2026-06-06  
**Project:** Split Partnering  
**Purpose:** Enable `adminDb` writes on Vercel for payment verification and webhook processing

---

## Step 1 — Obtain the Service Account JSON from Firebase Console

### 1.1 Open Firebase Console

Navigate to: **[https://console.firebase.google.com](https://console.firebase.google.com)**

### 1.2 Select your project

Click on **Split Partnering** (project ID: `splitpartnering`).

### 1.3 Open Project Settings

In the top-left, click the **gear icon ⚙️ → Project settings**.

### 1.4 Go to Service Accounts tab

Click the **Service accounts** tab at the top of the settings page.

### 1.5 Generate a new private key

1. You will see card titled **"Firebase Admin SDK"**.
2. At the bottom of this card, click the blue **"Generate new private key"** button.
3. A confirmation dialog appears: *"You are about to generate a new private key..."* — click **"Generate key"**.
4. The browser will **download a `.json` file**.

### 1.6 Locate the downloaded file

The file is named something like:

```
splitpartnering-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
```

Save this file in a secure location. It contains your Firebase private key and must never be committed to Git or shared.

---

## Step 2 — Understanding the JSON Structure

### Full structure of the downloaded file

```json
{
  "type": "service_account",
  "project_id": "splitpartnering",
  "private_key_id": "a1b2c3d4e5f6...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@splitpartnering.iam.gserviceaccount.com",
  "client_id": "123456789012345678901",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40splitpartnering.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
```

### Fields that `admin.js` actually uses

| Field | Used by `admin.credential.cert()`? | Notes |
|-------|------------------------------------|-------|
| `type` | ✅ Yes | Must be `"service_account"` |
| `project_id` | ✅ Yes | Must match your Firebase project |
| `private_key_id` | ✅ Yes | Used to identify the key |
| `private_key` | ✅ Yes | The actual RSA private key — **critical** |
| `client_email` | ✅ Yes | The service account email |
| `client_id` | ✅ Yes | Numeric ID of the service account |
| `auth_uri` | ✅ Yes | OAuth endpoint |
| `token_uri` | ✅ Yes | Token exchange endpoint |
| `auth_provider_x509_cert_url` | ✅ Yes | Certificate URL |
| `client_x509_cert_url` | ✅ Yes | Service account cert URL |
| `universe_domain` | ⚠️ Ignored by older SDKs | Present in newer files; SDK ignores it |

**Do NOT remove any fields.** The entire JSON object is passed to `admin.credential.cert(serviceAccount)` and Firebase Admin SDK parses it internally. Removing any field may cause silent failures.

---

## Step 3 — Convert JSON to a Single-Line Environment Variable

### Why it must be single-line

Environment variables cannot contain raw newlines. The `.env.local` file format and Vercel's dashboard both require the value to be on a single line. The `private_key` field contains `\n` escape sequences which are valid JSON and must be preserved.

### 3.1 Method A — Using Node.js (Recommended)

Create a temporary file `convert-key.js` in your project root:

```javascript
const fs = require("fs");

const json = JSON.parse(
  fs.readFileSync("splitpartnering-firebase-adminsdk-xxxxx-xxxxxxxxxx.json", "utf8")
);

const singleLine = JSON.stringify(json);

fs.writeFileSync("service-account-oneline.txt", singleLine);

console.log("Done! Copy the contents of service-account-oneline.txt");
```

Run it:

```bash
node convert-key.js
```

The output file `service-account-oneline.txt` contains the entire JSON as a single line. Copy its contents.

**Delete both files after use:**
```bash
rm convert-key.js service-account-oneline.txt
```

### 3.2 Method B — Using Python

```bash
python -c "import json; f=open('splitpartnering-firebase-adminsdk-xxxxx-xxxxxxxxxx.json'); print(json.dumps(json.load(f)))" > service-account-oneline.txt
```

### 3.3 Method C — Manual (Risk of errors)

1. Open the JSON file in a text editor
2. Use **Edit → Replace** (or Ctrl+H)
3. Replace all newlines with `\n` (literal backslash-n) — **except** you need the JSON to remain valid
4. Better approach: Use a JSON minifier tool like [JSON Minifier](https://codebeautify.org/jsonminifier)

**⚠️ Warning:** Manual editing often breaks the `private_key` format. Use Method A or B.

### 3.4 What the final value looks like

A single (very long) line:

```
{"type":"service_account","project_id":"splitpartnering","private_key_id":"a1b2c3...","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@splitpartnering.iam.gserviceaccount.com","client_id":"123456789...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-xxxxx%40splitpartnering.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

---

## Step 4 — Add to Vercel

### 4.1 Open Vercel Dashboard

Navigate to: **[https://vercel.com](https://vercel.com)**

### 4.2 Select your project

Click on **Split Partnering** (or whatever your Vercel project is named).

### 4.3 Go to Settings → Environment Variables

1. Click the **Settings** tab
2. Click **Environment Variables** in the left sidebar

### 4.4 Add the variable

Click **"Add Environment Variable"** and fill in:

| Field | Value |
|-------|-------|
| **Name** | `FIREBASE_SERVICE_ACCOUNT_KEY` |
| **Value** | Paste the single-line JSON from Step 3 |
| **Environments** | ✅ Production, ✅ Preview, ✅ Development |
| **Git Branch** | Leave blank (all branches) |

**Important notes:**
- Do NOT wrap the value in quotes — paste the raw single-line JSON
- Vercel encrypts the value at rest
- The variable is available to Serverless Functions at runtime
- It is **not** exposed to the client (no `NEXT_PUBLIC_` prefix)

### 4.5 Redeploy your application

1. Go to the **Deployments** tab
2. Click the three dots (⋮) on your latest deployment
3. Click **"Redeploy"**
4. Confirm with **"Redeploy"**

### 4.6 Also add to `.env.local` for local testing

Add the same value to your `.env.local` file:

```bash
# .env.local
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"splitpartnering",...}
```

Note: `.env.local` allows `"` characters without escaping if the value is not wrapped in quotes.

```
Correct:  FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
Incorrect: FIREBASE_SERVICE_ACCOUNT_KEY="{"type":"service_account",...}"
```

---

## Step 5 — Test `adminDb` Connectivity After Deployment

### 5.1 Create a test API route (temporary)

Create `app/api/test-admin/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";

export async function GET() {
  try {
    // Attempt a simple read — this is the first network call
    // If adminDb is not authenticated, this will throw
    const testQuery = await adminDb
      .collection("payments")
      .limit(1)
      .get();

    return NextResponse.json({
      success: true,
      message: "adminDb connected successfully",
      docsFound: testQuery.size,
    });
  } catch (error: any) {
    console.error("adminDb connectivity test failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        code: error?.code || "UNKNOWN",
      },
      { status: 500 }
    );
  }
}
```

### 5.2 Test locally

```bash
# Ensure .env.local has FIREBASE_SERVICE_ACCOUNT_KEY
npm run dev
```

Then visit: **http://localhost:3000/api/test-admin**

**Expected success response:**
```json
{
  "success": true,
  "message": "adminDb connected successfully",
  "docsFound": 0
}
```

### 5.3 Test on Vercel

After redeploy, visit:

```
https://partnering.in/api/test-admin
```

**Expected success response:**
```json
{
  "success": true,
  "message": "adminDb connected successfully",
  "docsFound": 0
}
```

### 5.4 Expected error response (if key is wrong)

```json
{
  "success": false,
  "error": "Failed to determine project ID from credentials or default credentials",
  "code": "UNKNOWN"
}
```

If you see this, the key is not being picked up correctly. Debug:

1. Verify the variable name is exactly `FIREBASE_SERVICE_ACCOUNT_KEY`
2. Verify the value is single-line, valid JSON
3. Check Vercel logs: Project Dashboard → **Functions** tab → find the failed invocation
4. Check Vercel Runtime Logs: Project Dashboard → **Logs** → **Runtime Logs**

### 5.5 Delete the test route

Once confirmed working, delete `app/api/test-admin/route.ts`:

```bash
rm app/api/test-admin/route.ts
```

Do not ship test routes to production.

---

## Troubleshooting

### Issue: `Failed to determine project ID`

| Cause | Fix |
|-------|-----|
| `FIREBASE_SERVICE_ACCOUNT_KEY` not set in Vercel | Add it via Vercel Dashboard → Settings → Environment Variables |
| Value pasted with quotes | Remove surrounding `"` quotes from the value |
| Value contains literal newlines | Re-minify the JSON to a single line |
| `private_key` corrupted | Re-download the key from Firebase Console and regenerate |
| Deployed before variable was added | Redeploy the project |

### Issue: `Service account object must contain a string "private_key" field`

The `private_key` was mangled during minification. The `\n` sequences must remain as actual `\n` (backslash + n), not converted to real newlines. Use the Node.js method (Step 3.1) which handles this correctly.

### Issue: `Permission denied` on Firestore reads/writes

The service account needs Firestore permissions:

1. Go to **[Google Cloud Console](https://console.cloud.google.com)** → IAM & Admin → IAM
2. Find the service account email: `firebase-adminsdk-xxxxx@splitpartnering.iam.gserviceaccount.com`
3. Click the edit (pencil) icon
4. Verify it has the **"Cloud Datastore User"** role (or "Firebase Admin SDK" which includes it)
5. If missing, click **"Add Another Role"** → search for "Cloud Datastore User" → add it

### Issue: JSON parse error on import

The `admin.js` file uses `JSON.parse(serviceAccountKey)` on line 9. If this throws:

```
SyntaxError: Unexpected token ...
```

The environment variable value is not valid JSON. Re-minify the original JSON file and try again.

---

## Security Checklist

- [ ] Service account JSON is **never committed to Git** (add to `.gitignore`)
- [ ] Service account JSON is **never shared via email, chat, or screenshots**
- [ ] Environment variable is **not prefixed with `NEXT_PUBLIC_`** (would expose to client)
- [ ] Key is stored in Vercel's encrypted environment variable storage
- [ ] `.env.local` is in `.gitignore` (it should already be there by default)
- [ ] If key is compromised: revoke it immediately in **Firebase Console → Project Settings → Service Accounts → "Manage service account permissions"** → Delete key, then generate a new one

---

## Appendix A — Razorpay Webhook Configuration

### A1. Generate a Webhook Secret

Generate a cryptographically strong secret:

```bash
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using OpenSSL (if installed)
openssl rand -hex 32

# Option 3: Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

All three produce a 64-character hex string. Example output:

```
a7f8c3e1b2d9456e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2
```

This is your `RAZORPAY_WEBHOOK_SECRET`. Save it.

---

### A2. Configure the Webhook in Razorpay Dashboard

1. Go to **[Razorpay Dashboard](https://dashboard.razorpay.com)** → **Settings** → **Webhooks**
2. Click **"Add New Webhook"**

Fill in the form:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://partnering.in/api/razorpay-webhook` |
| **Secret** | Paste the hex string generated in Step A1 |
| **Events** | Select **`payment.captured`** (only this one) |
| **Active** | Toggle to **Enabled** |

3. Click **"Save Webhook"**

Razorpay will now send a POST request to `https://partnering.in/api/razorpay-webhook` every time a payment is successfully captured. The request includes the `x-razorpay-signature` header which your webhook handler verifies using the secret you just configured.

---

### A3. Add the Secret to Vercel

1. Open **[Vercel Dashboard](https://vercel.com)** → select **Split Partnering** project
2. Go to **Settings** → **Environment Variables**
3. Click **"Add Environment Variable"**

| Field | Value |
|-------|-------|
| **Name** | `RAZORPAY_WEBHOOK_SECRET` |
| **Value** | Paste the 64-character hex string from Step A1 |
| **Environments** | ✅ Production, ✅ Preview, ✅ Development |
| **Git Branch** | Leave blank (all branches) |

4. Click **"Save"**
5. Go to **Deployments** → latest deployment → **⋮** → **Redeploy**

---

### A4. Add the Secret to `.env.local` for Local Testing

Append this line to your `.env.local`:

```bash
# Razorpay webhook secret
RAZORPAY_WEBHOOK_SECRET=a7f8c3e1b2d9456e8f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2
```

Replace the value with your actual generated secret.

---

### A5. Test the Webhook Locally

1. Start your dev server:

```bash
npm run dev
```

2. (Optional) Use `ngrok` to expose your local server for webhook testing:

```bash
ngrok http 3000
```

3. Update the webhook URL in Razorpay Dashboard (Settings → Webhooks → Edit) to your ngrok URL:

```
https://your-ngrok-subdomain.ngrok.io/api/razorpay-webhook
```

4. Make a test payment through the app.

5. Check the Razorpay Dashboard → **Webhooks** tab → **Logs** to verify HTTP 200 responses.

6. Check your terminal logs for:

```
Razorpay payment captured: pay_XXXXXXXXXX, groupId=XXXX, uid=XXXX
Payment pay_XXXXXXXXXX finalized and member marked paid
```

---

### A6. Verify the Webhook in Production

Use the Razorpay Dashboard's **"Send Test Webhook"** feature:

1. Razorpay Dashboard → **Settings** → **Webhooks**
2. Click the **⋮** (three dots) next to your webhook
3. Click **"Send Test Webhook"**
4. Select event type: **`payment.captured`**
5. Check the **Logs** tab — expect HTTP 200 response

**Note:** The test webhook has an empty `notes` object (no `groupId`/`uid`), so the handler returns `{ received: true, skipped: true }` with HTTP 200. This is correct — a real webhook from an actual payment will have `groupId` and `uid` in the notes.

---

### A7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Webhook returns 500, logs "Webhook secret not configured" | `RAZORPAY_WEBHOOK_SECRET` not set in Vercel env | Add it via Vercel Dashboard → Redeploy |
| Webhook returns 400 "Invalid webhook signature" | Secret mismatch between Vercel and Razorpay Dashboard | Copy exact secret from Razorpay Dashboard → paste into Vercel |
| Webhook returns 500, logs "Failed to determine project ID" | `FIREBASE_SERVICE_ACCOUNT_KEY` not set | Follow the main guide above to configure it |
| No webhook received | Razorpay cannot reach your URL | Verify domain is public and Vercel deployment is healthy |

---

## Quick Reference

### FIREBASE_SERVICE_ACCOUNT_KEY

```
Step 1: Firebase Console → Project Settings → Service Accounts → Generate Key
Step 2: Download JSON file
Step 3: node -e "console.log(JSON.stringify(require('./downloaded-file.json')))" > key.txt
Step 4: Vercel Dashboard → Settings → Env Vars → Add FIREBASE_SERVICE_ACCOUNT_KEY
Step 5: Paste single-line JSON from key.txt
Step 6: Redeploy
Step 7: Test with /api/test-admin
Step 8: Delete test route
```

### RAZORPAY_WEBHOOK_SECRET

```
Step 1: Generate secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Step 2: Razorpay Dashboard → Settings → Webhooks → Add New
Step 3: URL: https://partnering.in/api/razorpay-webhook
Step 4: Event: payment.captured
Step 5: Secret: paste generated hex string
Step 6: Save webhook
Step 7: Vercel Dashboard → Settings → Env Vars → Add RAZORPAY_WEBHOOK_SECRET
Step 8: Paste the same hex string
Step 9: Redeploy