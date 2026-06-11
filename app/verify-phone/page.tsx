"use client";

import { useState, useCallback } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithCredential,
  PhoneAuthProvider,
} from "firebase/auth";

import { auth } from "@/firebase/config";
import toast from "react-hot-toast";


export default function VerifyPhonePage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ---------------- SETUP RECAPTCHA (visible fallback) ---------------- */

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
              resolve(window.recaptchaVerifier);
            },
            "expired-callback": () => {
              if (window.recaptchaVerifier) {
                window.recaptchaVerifier.reset();
              }
            },
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  /* ---------------- HANDLE VERIFY ---------------- */

  const handleVerify = async () => {
    if (!phone || phone.length !== 10) {
      toast.error("Enter valid mobile number");
      return;
    }

    try {
      setLoading(true);

      /* -------- SEND OTP -------- */

      if (!otpSent) {
        const verifier = await setupRecaptcha();

        const confirmation = await signInWithPhoneNumber(
          auth,
          `+91${phone}`,
          verifier
        );

        window.confirmationResult = confirmation;

        setOtpSent(true);

        toast.success("OTP Sent 📩");

        return;
      }

      /* -------- VERIFY OTP -------- */

      if (!window.confirmationResult) {
        toast.error("OTP session expired");
        return;
      }

      const credential = PhoneAuthProvider.credential(
        window.confirmationResult.verificationId,
        otp
      );

      if (auth.currentUser) {
        await linkWithCredential(
          auth.currentUser,
          credential
        );

        toast.success(
          "Phone Linked Successfully 🔗"
        );

        window.location.href = "/payment";
      } else {
        toast.error("User not logged in");
      }
    } catch (error: any) {
      console.error(error);

      if (error.code === "auth/invalid-verification-code") {
        toast.error("Invalid OTP");
      } else if (
        error.code === "auth/too-many-requests"
      ) {
        toast.error(
          "Too many attempts. Try later."
        );
      } else {
        toast.error("Verification Failed ❌");
      }
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-4">
      <h2 className="text-2xl mb-6 text-[#E6C972] font-bold text-center">
        Verify Phone Before Payment
      </h2>

      {/* PHONE INPUT */}

      <input
        type="tel"
        placeholder="Enter Mobile Number"
        value={phone}
        onChange={(e) =>
          setPhone(
            e.target.value.replace(/\D/g, "")
          )
        }
        maxLength={10}
        className="w-72 p-3 rounded-xl bg-black border-2 border-[#E6C972] text-[#E6C972] outline-none"
      />

      {/* OTP INPUT */}

      {otpSent && (
        <input
          type="number"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="w-72 p-3 rounded-xl bg-black border-2 border-[#E6C972] text-[#E6C972] mt-4 outline-none"
        />
      )}

      {/* BUTTON */}

      <button
        onClick={handleVerify}
        disabled={loading}
        className="mt-6 px-6 py-3 bg-[#E6C972] text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
      >
        {loading
          ? "Please wait..."
          : otpSent
          ? "Verify OTP"
          : "Send OTP"}
      </button>

      {/* RECAPTCHA */}

      <div id="recaptcha-container"></div>
    </div>
  );
}