"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { doc, setDoc, getDoc } from "firebase/firestore";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [country, setCountry] = useState("");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);

  const phone =
    typeof window !== "undefined" ? localStorage.getItem("phone") : null;
  const guest =
    typeof window !== "undefined"
      ? localStorage.getItem("guest") === "true"
      : false;

  /* ------------------------------------------
        FETCH PROFILE VALUES
  ------------------------------------------- */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      const userRef = doc(db, "users", phone);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setName(data.name || "");
        setCity(data.city || "");
        setStateVal(data.state || "");
        setCountry(data.country || "");
        setPincode(data.pincode || "");
        setAddress(data.address || "");
      }

      setLoading(false);
    };

    fetchProfile();
  }, [phone]);

  /* ------------------------------------------
        SAVE PROFILE
  ------------------------------------------- */
  const saveProfile = async () => {
    if (guest) {
      return alert("You are in guest mode. Please login to save your profile.");
    }

    if (!phone) return alert("Login again. Phone number missing!");

    const userRef = doc(db, "users", phone);

    await setDoc(
      userRef,
      {
        phone,
        name,
        city,
        state: stateVal,
        country,
        pincode,
        address,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    alert("Profile saved successfully!");
    window.location.href = "/categories";
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  if (!phone && !guest) {
    return (
      <div className="pt-32 px-6 text-white text-center">
        <h1 className="text-3xl font-bold text-[#FFD700]">Profile</h1>
        <p className="mt-3 text-gray-300">
          Please login first to update your profile.
        </p>
      </div>
    );
  }

  if (loading)
    return (
      <div className="pt-32 px-6 text-white text-center">
        Loading Profile...
      </div>
    );

  return (
    <div className="text-white pt-32 flex flex-col items-center gap-5 px-6">
      <h1 className="text-3xl font-bold text-[#FFD700] mb-1">
        Your Profile
      </h1>

      {/* PLATFORM ROLE STATEMENT */}
      <div className="max-w-md text-center text-xs text-gray-400 mb-2">
        SplitPartnering is a{" "}
        <span className="text-[#FFD700] font-semibold">
          partnering service
        </span>
        . We help people find partners to share costs and access group benefits.
        We do <span className="text-red-400">not</span> buy or sell any products or
        services.
      </div>

      <p className="text-gray-400 text-sm mb-2">
        {guest
          ? "Guest Mode: You can browse, but cannot save details."
          : "Keep your profile accurate. Partners trust verified details."}
      </p>

      {/* PHONE DISPLAY */}
      <div className="bg-black/50 border border-[#FFD700]/30 px-4 py-2 rounded-lg w-72 text-center text-sm mb-2">
        Phone:{" "}
        <span className="text-[#FFD700] font-semibold">
          {phone ? phone : "Guest"}
        </span>
      </div>

      {/* FORM FIELDS */}
      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      <input
        type="text"
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      <input
        type="text"
        placeholder="State"
        value={stateVal}
        onChange={(e) => setStateVal(e.target.value)}
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      <input
        type="text"
        placeholder="Country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      <input
        type="text"
        placeholder="Pincode"
        value={pincode}
        onChange={(e) => setPincode(e.target.value)}
        className="neon-input w-72 border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      <textarea
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="neon-input w-72 h-20 resize-none border-[#FFD700]/30 focus:border-[#FFD700]"
        disabled={guest}
      />

      {/* SAVE BUTTON */}
      {!guest && (
        <button
          onClick={saveProfile}
          className="bg-[#FFD700] text-black px-6 py-3 rounded-xl font-bold hover:bg-[#FFEB99] transition-all mt-2"
        >
          Save Profile
        </button>
      )}

      {/* TRUST NOTE */}
      <div className="max-w-md text-center text-[11px] text-gray-400 mt-2">
        Your details help us suggest better partners in your city.
        Payments and purchases always happen directly between partners and
        providers.
      </div>

      {/* LOGOUT */}
      <button
        onClick={logout}
        className="text-red-400 underline text-sm mt-3"
      >
        Logout
      </button>

      {/* ADMIN */}
      <button
        onClick={() => (window.location.href = "/admin")}
        className="text-[10px] opacity-20 mt-1"
      >
        admin
      </button>

      {/* AI CHAT */}
      <button
        onClick={() => (window.location.href = "/ai")}
        className="mt-4 text-[#FFD700] text-sm underline"
      >
        Chat with AI 🤖
      </button>
    </div>
  );
}
