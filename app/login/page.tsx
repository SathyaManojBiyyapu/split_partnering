"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
} from "firebase/auth";

import { auth, googleProvider } from "@/firebase/config";
import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

declare global {
  interface Window {
    recaptchaVerifier: any;
    confirmationResult: any;
  }
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  /* Setup reCAPTCHA */
  const setupRecaptcha = (): Promise<any> => {
    return new Promise<any>((resolve, reject) => {
      try {
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch (_) {}
          window.recaptchaVerifier = null;
        }

        window.recaptchaVerifier = new RecaptchaVerifier(
          auth,
          "recaptcha-container",
          {
            size: "normal",
            callback: () => {
              console.log("reCAPTCHA verified");
            },
            "expired-callback": () => {
              if (window.recaptchaVerifier) {
                window.recaptchaVerifier.reset();
              }
            },
          }
        );

        resolve(window.recaptchaVerifier);
      } catch (err) {
        reject(err);
      }
    });
  };

  /* Login with OTP */
  const handleLoginWithOTP = async () => {
    if (!phone || phone.length !== 10) {
      toast.error("Enter valid 10-digit mobile number");
      return;
    }

    try {
      setLoading(true);

      if (!otpSent) {
        const verifier = await setupRecaptcha();
        const confirmation = await signInWithPhoneNumber(
          auth,
          "+91" + phone,
          verifier
        );

        window.confirmationResult = confirmation;
        setOtpSent(true);
        toast.success("OTP sent to your mobile 📩");
        return;
      }

      if (!otp) {
        toast.error("Enter OTP");
        return;
      }

      // --- STEP 1: Confirm OTP ---
      const credential = await window.confirmationResult.confirm(otp);

      // ================ BACKEND AUTH DIAGNOSTIC ================
      if (credential.user) {
        // Log Firebase project config
        try {
          const { getApp } = await import("firebase/app");
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const firebaseApp = getApp();
          // Use auth.app.options to get config
          const appOptions = (auth as any).app?.options || {};
          console.log("================ FIREBASE PROJECT ================");
          console.log("projectId:", appOptions.projectId || "unknown");
          console.log("authDomain:", appOptions.authDomain || "unknown");
          console.log("storageBucket:", appOptions.storageBucket || "unknown");
          console.log("appId:", appOptions.appId || "unknown");
          console.log("apiKey:", appOptions.apiKey ? "***" + appOptions.apiKey.slice(-4) : "unknown");
          console.log("===============================================");
        } catch (_e) {
          console.log("================ FIREBASE PROJECT ================");
          console.log("Could not read app options");
          console.log("===============================================");
        }

        // Log auth user data
        console.log("================ AUTH USER ======================");
        console.log("uid:", credential.user.uid);
        console.log("phoneNumber:", credential.user.phoneNumber);
        console.log("email:", credential.user.email);
        console.log("providerData:");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        credential.user.providerData?.forEach((p: any, i: number) => {
          console.log("  [" + i + "] providerId:", p?.providerId, "uid:", p?.uid, "phoneNumber:", p?.phoneNumber, "email:", p?.email);
        });
        console.log("===============================================");

        // Log JWT claims
        try {
          const tokenResult = await credential.user.getIdTokenResult(true);
          console.log("================ JWT ===========================");
          console.log("claims:", JSON.stringify(tokenResult.claims, null, 2));
          console.log("claims.phone_number:", (tokenResult.claims as any).phone_number);
          console.log("claims.firebase:", JSON.stringify((tokenResult.claims as any).firebase, null, 2));
          console.log("authTime:", tokenResult.authTime);
          console.log("issuedAtTime:", tokenResult.issuedAtTime);
          console.log("expirationTime:", tokenResult.expirationTime);
          console.log("signInProvider:", tokenResult.signInProvider);
          console.log("===============================================");
        } catch (_e) {
          console.log("================ JWT ===========================");
          console.log("Could not get token result");
          console.log("===============================================");
        }

        // Comparison
        const cleanPhone = phone.trim();
        const authPhone = credential.user.phoneNumber?.replace(/^\+91/, "").trim() ?? "";
        try {
          const tokenResult = await credential.user.getIdTokenResult(true);
          const jwtPhone = (tokenResult.claims as any).phone_number;
          console.log("================ COMPARISON =====================");
          console.log("CLIENT PHONE:", authPhone);
          console.log("JWT PHONE:", jwtPhone);
          console.log("DOC ID:", cleanPhone);
          console.log("client === jwt:", authPhone === jwtPhone);
          console.log("client === docId:", authPhone === cleanPhone);
          console.log("jwt === docId:", jwtPhone === cleanPhone);
          console.log("===============================================");
        } catch (_e) {
          console.log("================ COMPARISON =====================");
          console.log("Cannot compare - JWT unavailable");
          console.log("===============================================");
        }
      }
      // ================ END BACKEND AUTH DIAGNOSTIC ================

      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("phone", phone.trim());
      localStorage.removeItem("guest");

      toast.success("Login successful 🎉");

      // --- STEP 5: First Firestore operation after login ---
      const cleanPhone = phone.trim();
      const docPath = "users/" + cleanPhone;
      console.log("================ FIRESTORE ======================");
      console.log("document path:", docPath);
      const userRef = doc(db, "users", cleanPhone);

      let userSnap;
      try {
        userSnap = await getDoc(userRef);
        console.log("getDoc SUCCESS, exists:", userSnap.exists());
        console.log("===============================================");
      } catch (fsError: any) {
        console.error("getDoc FAILED");
        console.error("code:", fsError.code);
        console.error("message:", fsError.message);
        console.error("stack:", fsError.stack);
        console.log("===============================================");
        throw fsError;
      }

      const profileCompleted = userSnap.exists() && (userSnap.data() as any)?.profileCompleted === true;
      window.location.href = profileCompleted ? "/" : "/profile";
    } catch (err: any) {
      // --- DETAILED ERROR LOGGING (diagnostic) ---
      console.log("[signInWithPhoneNumber Error Debug]");
      console.log("  error.code:", err?.code || "N/A");
      console.log("  error.message:", err?.message || "N/A");
      console.log("  error.customData:", JSON.stringify(err?.customData || {}));
      console.log("  error.toString():", err?.toString() || "N/A");
      console.log("  Full error object:", err);
      // --- END DIAGNOSTIC ---

      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.reset();
        } catch (_) {}
      }

      const code = err?.code || "";
      const message = err?.message || err?.toString() || "Unknown error";

      if (code === "auth/internal-error" || code === "auth/network-request-failed") {
        toast.error("Phone login unavailable. Please use Google login instead.");
      } else if (code === "auth/invalid-phone-number") {
        toast.error("Invalid phone number. Enter a valid 10-digit number.");
      } else if (code === "auth/too-many-requests") {
        toast.error("Too many attempts. Please try again later.");
      } else if (code === "auth/code-expired") {
        toast.error("OTP expired. Please request a new one.");
        setOtpSent(false);
        window.confirmationResult = null;
      } else {
        toast.error(`OTP failed: ${message.substring(0, 80)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  /* Login with Google */
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("uid", user.uid);
      localStorage.setItem("email", user.email || "");
      localStorage.setItem("name", user.displayName || "");

      const authPhone = user.phoneNumber?.replace(/^\+91/, "").trim();
      if (authPhone) {
        localStorage.setItem("phone", authPhone);
      }

      localStorage.removeItem("guest");

      toast.success("Google login successful 🎉");

      /* Post-login redirection */
      const gUserRef = doc(db, "users", auth.currentUser?.uid || user.uid);
      const gUserSnap = await getDoc(gUserRef);
      const gProfileCompleted = gUserSnap.exists() && (gUserSnap.data() as any)?.profileCompleted === true;
      window.location.href = gProfileCompleted ? "/" : "/profile";
    } catch (err) {
      console.error("Firebase Auth Error:", err);
      toast.error("Google login failed ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-28 flex flex-col items-center text-white relative overflow-hidden">
      {/* Background glow */}
      <div className="hero-glow" style={{ top: '-20%', left: '50%', transform: 'translateX(-50%)' }} />
      <div className="hero-gradient absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#D4AF37]">
            Login / Signup
          </h1>
          <p className="text-sm text-gray-400 mt-2">Welcome back to PartnerSync</p>
        </div>

        <div className="card-premium p-6 sm:p-8 space-y-5">
          {/* PHONE INPUT */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Phone Number</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">+91</span>
              <input
                type="tel"
                placeholder="Enter Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input w-full pl-11"
                disabled={otpSent}
              />
            </div>
          </div>

          {/* OTP INPUT */}
          {otpSent && (
            <div className="animate-fadeIn">
              <label className="block text-xs text-gray-400 mb-1.5">One-Time Password</label>
              <input
                type="number"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="input w-full"
              />
            </div>
          )}

          {/* OTP BUTTON */}
          <button
            onClick={handleLoginWithOTP}
            disabled={loading}
            className="btn-primary w-full text-center"
          >
            {loading
              ? "Please wait..."
              : otpSent
              ? "Verify OTP"
              : "Login with OTP"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-gray-500 text-xs">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            <span>or</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          </div>

          {/* GOOGLE LOGIN */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="btn-outline w-full text-center flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* ADMIN LINK */}
        <button
          onClick={() => (window.location.href = "/admin")}
          className="text-[10px] opacity-30 mt-6 hover:opacity-60 transition block mx-auto"
        >
          admin
        </button>
      </div>

      <div id="recaptcha-container" className="mt-4"></div>
    </div>
  );
}