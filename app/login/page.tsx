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

      await window.confirmationResult.confirm(otp);

      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("phone", phone.trim());
      localStorage.removeItem("guest");

      toast.success("Login successful 🎉");

      /* Post-login redirection */
      const cleanPhone = phone.trim();
      const userRef = doc(db, "users", cleanPhone);
      const userSnap = await getDoc(userRef);
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
    <div className="min-h-screen pt-28 flex flex-col items-center text-white">
      <h1 className="text-3xl font-bold text-[#D4AF37] mb-8">
        Login / Signup
      </h1>

      <div className="max-w-sm w-full space-y-4 px-4">
        {/* PHONE INPUT */}
        <input
          type="tel"
          placeholder="Enter Mobile Number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input w-full"
          disabled={otpSent}
        />

        {/* OTP INPUT */}
        {otpSent && (
          <input
            type="number"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="input w-full"
          />
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
          <div className="flex-1 h-px bg-gray-800" />
          <span>or</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        {/* GOOGLE LOGIN */}
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="btn-outline w-full text-center"
        >
          Continue with Google
        </button>

        {/* ADMIN LINK */}
        <button
          onClick={() => (window.location.href = "/admin")}
          className="text-[10px] opacity-30 mt-8 hover:opacity-60 transition block mx-auto"
        >
          admin
        </button>
      </div>

      <div id="recaptcha-container"></div>
    </div>
  );
}