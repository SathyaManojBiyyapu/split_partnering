"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
} from "firebase/auth";

import { auth, googleProvider } from "@/firebase/config";
import toast from "react-hot-toast"; // ✅ ADDED (ONLY THIS IMPORT)

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

  /* ------------------------------------------
     SETUP RECAPTCHA
  ------------------------------------------ */
  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        "recaptcha-container",
        { size: "invisible" }
      );
    }
    return window.recaptchaVerifier;
  };

  /* ------------------------------------------
     LOGIN WITH OTP
  ------------------------------------------ */
  const handleLoginWithOTP = async () => {
    if (!phone || phone.length !== 10) {
      alert("Enter valid 10-digit mobile number");
      toast.error("Enter valid 10-digit mobile number"); // ✅ ADDED
      return;
    }

    try {
      setLoading(true);

      if (!otpSent) {
        const verifier = setupRecaptcha();
        const confirmation = await signInWithPhoneNumber(
          auth,
          "+91" + phone,
          verifier
        );

        window.confirmationResult = confirmation;
        setOtpSent(true);
        alert("OTP sent to your mobile");
        toast.success("OTP sent to your mobile 📩"); // ✅ ADDED
        return;
      }

      if (!otp) {
        alert("Enter OTP");
        toast.error("Enter OTP"); // ✅ ADDED
        return;
      }

      await window.confirmationResult.confirm(otp);

      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("phone", phone.trim());
      localStorage.removeItem("guest");

      alert("Login successful!");
      toast.success("Login successful 🎉"); // ✅ ADDED
      window.location.href = "/profile";
    } catch (err) {
      console.error(err);
      alert("OTP failed. Try again.");
      toast.error("OTP failed. Try again ❌"); // ✅ ADDED
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------
     LOGIN WITH GOOGLE
  ------------------------------------------ */
  const handleGoogleLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      localStorage.setItem("loggedIn", "true");
      localStorage.setItem("uid", user.uid);
      localStorage.setItem("email", user.email || "");
      localStorage.setItem("name", user.displayName || "");
      localStorage.removeItem("guest");

      alert("Google login successful!");
      toast.success("Google login successful 🎉"); // ✅ ADDED
      window.location.href = "/profile";
    } catch (err) {
      console.error(err);
      alert("Google login failed");
      toast.error("Google login failed ❌"); // ✅ ADDED
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-28 flex flex-col items-center text-white">
      <h1 className="text-3xl font-bold text-gold-primary mb-8">
        Login / Signup
      </h1>

      {/* PHONE INPUT */}
      <input
        type="tel"
        placeholder="Enter Mobile Number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="neon-input w-64"
        disabled={otpSent}
      />

      {/* OTP INPUT */}
      {otpSent && (
        <input
          type="number"
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className="neon-input w-64 mt-4"
        />
      )}

      {/* OTP BUTTON */}
      <button
        onClick={handleLoginWithOTP}
        disabled={loading}
        className="
          mt-6 px-8 py-3 rounded-xl font-bold
          bg-black
          text-[#E6C972]
          border border-[#E6C972]
          shadow-[0_0_18px_rgba(230,201,114,0.75)]
          hover:bg-[#F3DC8A]
          hover:text-black
          hover:shadow-[0_0_36px_rgba(230,201,114,1)]
          transition-all duration-200
        "
      >
        {loading
          ? "Please wait..."
          : otpSent
          ? "Verify OTP"
          : "Login with OTP"}
      </button>

      {/* GOOGLE LOGIN */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="
          mt-4 px-8 py-3 rounded-xl font-semibold
          border border-gray-500
          hover:bg-white/10
          transition
        "
      >
        Continue with Google
      </button>

      {/* ADMIN */}
      <button
        onClick={() => (window.location.href = "/admin")}
        className="text-[10px] opacity-30 mt-8 hover:opacity-60 transition"
      >
        admin
      </button>

      <div id="recaptcha-container"></div>
    </div>
  );
}
