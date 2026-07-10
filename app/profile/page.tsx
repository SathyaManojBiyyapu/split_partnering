"use client";

import { useState, useEffect } from "react";
import { db, storage, auth } from "@/firebase/config";
import { signOut } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { indiaStates } from "@/app/data/indiaStates";
import { districts } from "@/app/data/districts";
import { citiesByDistrict } from "@/app/data/cities";
import toast from "react-hot-toast";

export default function ProfilePage() {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [gender, setGender] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [college, setCollege] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  const rawPhone = typeof window !== "undefined" ? (localStorage.getItem("phone") || "") : "";
  const phone = rawPhone.trim();
  const guest = typeof window !== "undefined" ? localStorage.getItem("guest") === "true" : false;

  const selectedStateDistricts = stateVal && districts ? (districts as any)[stateVal] || [] : [];
  const selectedDistrictCities = district && citiesByDistrict ? (citiesByDistrict as any)[stateVal]?.[district] || [] : [];

  /* Fetch profile */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userRef = doc(db, "users", phone);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as any;
          setName(data.name || "");
          setCity(data.city || "");
          setDistrict(data.district || "");
          setStateVal(data.state || "");
          setGender(data.gender || "");
          setBio(data.bio || "");
          setInterests(data.interests || "");
          setCollege(data.college || "");
          setPhotoURL(data.photoURL || "");
          setProfileCompleted(data.profileCompleted === true);
        }
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [phone]);

  /* Image upload */
  const handleImageUpload = async (e: any) => {
    try {
      const file = e.target.files[0];
      if (!file || !phone) return;

      setUploadLoading(true);
      const imageRef = ref(storage, `profilePictures/${phone}_${Date.now()}`);
      await uploadBytes(imageRef, file);
      const downloadURL = await getDownloadURL(imageRef);
      setPhotoURL(downloadURL);
      toast.success("Profile photo uploaded ✅");
    } catch (error) {
      console.error(error);
      toast.error("Image upload failed ❌");
    } finally {
      setUploadLoading(false);
    }
  };

  /* Save profile */
  const saveProfile = async () => {
    if (guest) {
      toast.error("You are in guest mode. Please login to save your profile.");
      return;
    }

    if (!phone) {
      toast.error("Login again. Phone number missing!");
      return;
    }

    if (!stateVal || !district || !city) {
      toast.error("Please select State, District, and City.");
      return;
    }

    try {
      setSaving(true);

      const currentUser = auth.currentUser;
      const authPhoneRaw = currentUser?.phoneNumber || null;
      const authPhone = authPhoneRaw ? authPhoneRaw.replace(/^\+91/, "").trim() : null;
      const authUid = currentUser?.uid || null;

      // Normalize: use auth phone if available, otherwise fall back to localStorage
      const docPhone = authPhone || phone;

      // Log diagnostic info to console
      console.log("[Profile Save Debug]");
      console.log("  auth.currentUser.uid:", authUid);
      console.log("  auth.currentUser.phoneNumber:", authPhoneRaw);
      console.log("  normalized authPhone:", authPhone);
      console.log("  localStorage phone:", phone);
      console.log("  doc ID to write:", docPhone);
      console.log("  doc path:", "users/" + docPhone);

      // Check if the document already exists
      const userRef = doc(db, "users", docPhone);
      const existingSnap = await getDoc(userRef);
      const docExists = existingSnap.exists();
      console.log("  document exists:", docExists);

      // Check what the Firestore rule will check:
      // rule: phone == myPhone10() where myPhone10() = phone_number.substring(3)
      // If authPhoneRaw is null (Google-only user), myPhone10() returns ""
      // So phone == "" will be false -> permission-denied
      console.log("  will rule pass? phone(" + docPhone + ") == myPhone10()(" + authPhone + "):", docPhone === authPhone);

      if (phone !== authPhone && currentUser) {
        console.warn("  PHONE MISMATCH: localStorage phone differs from auth phone. Updating localStorage.");
        if (authPhone) {
          localStorage.setItem("phone", authPhone);
        }
      }

      // Write: use setDoc with merge=true so it works whether exists or not
      await setDoc(
        userRef,
        {
          phone: docPhone,
          name,
          city,
          district,
          state: stateVal,
          gender,
          bio,
          interests,
          college,
          photoURL,
          verified: true,
          profileCompleted: true,
          profileStrength: [name, city, gender, bio, interests, college, photoURL].filter(Boolean).length * 15,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      if (docPhone !== phone) {
        localStorage.setItem("phone", docPhone);
      }

      toast.success("Profile saved successfully!");
      setProfileCompleted(true);
      window.location.href = "/categories";
    } catch (error: any) {
      console.error("[Profile Save Error]");
      console.error("  error.code:", error?.code || "N/A");
      console.error("  error.message:", error?.message || String(error));
      console.error("  full error:", error);

      const code = error?.code || "";
      if (code === "permission-denied") {
        toast.error("Profile save failed: Permission denied. Please re-login and try again.");
      } else if (code === "not-found") {
        toast.error("Profile document not found. Creating now...");
        // If updateDoc was used on a non-existent doc, we handle it above with setDoc
      } else {
        toast.error("Failed to save profile: " + (error?.message?.substring(0, 60) || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    localStorage.clear();
    window.location.href = "/login";
  };

  /* Login check */
  if (!phone && !guest) {
    return (
      <div className="pt-32 px-6 text-white text-center">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Profile</h1>
        <p className="mt-3 text-gray-300">Please login first to update your profile.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-32 px-6 text-white text-center">Loading Profile...</div>
    );
  }

  const profileStrength = [name, city, gender, bio, interests, college, photoURL].filter(Boolean).length * 15;

  return (
    <div className="text-white pt-32 flex flex-col items-center gap-5 px-6 pb-20">
      <h1 className="text-3xl font-bold text-[#D4AF37] mb-1">Your Profile</h1>

      {/* Premium info card */}
      <div className="w-72 p-4 rounded-xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1500] to-black text-center">
        <p className="text-[#D4AF37] text-sm font-semibold">✦ Complete Your Location Profile ✦</p>
        <p className="text-gray-300 text-xs mt-2 leading-relaxed">
          Complete your location profile to receive accurate local matches and better partnership opportunities.
        </p>
      </div>

      {/* Profile image */}
      <div className="relative">
        <img
          src={photoURL || "https://ui-avatars.com/api/?background=000000&color=D4AF37&name=User"}
          alt="Profile"
          className="w-28 h-28 rounded-full border-4 border-[#D4AF37] object-cover shadow-lg"
        />
      </div>

      {/* Image picker */}
      {!guest && (
        <label className="cursor-pointer text-sm text-[#D4AF37] underline">
          {uploadLoading ? "Uploading..." : "Upload Profile Photo"}
          <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
        </label>
      )}

      {/* Profile strength */}
      <div className="w-72">
        <div className="flex justify-between text-xs mb-1 text-gray-400">
          <span>Profile Strength</span>
          <span>{profileStrength}%</span>
        </div>
        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-[#D4AF37]" style={{ width: `${profileStrength}%` }} />
        </div>
      </div>

      {/* Note */}
      <div className="max-w-md text-center text-xs text-gray-400 mb-2">
        SplitPartnering is a{" "}
        <span className="text-[#D4AF37] font-semibold">partnering service</span>.
        We help people find partners to share costs and access group benefits.
      </div>

      <p className="text-gray-400 text-sm mb-2">
        {guest ? "Guest Mode: You can browse, but cannot save details." : "Keep your profile accurate. Partners trust verified details."}
      </p>

      {/* Phone */}
      <div className="bg-black/50 border border-[#D4AF37]/30 px-4 py-2 rounded-lg w-72 text-center text-sm mb-2">
        Phone: <span className="text-[#D4AF37] font-semibold">{phone || "Guest"}</span>
      </div>

      {profileCompleted && (
        <div className="text-[10px] text-yellow-400 text-center -mt-3 mb-1">
          Contact Admin if corrections are required.
        </div>
      )}

      {/* Name */}
      <input
        type="text"
        placeholder="Full Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={`input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37] ${profileCompleted ? "opacity-60 cursor-not-allowed" : ""}`}
        disabled={guest || profileCompleted}
      />

      {profileCompleted && name && (
        <div className="text-[10px] text-yellow-400 text-center -mt-3">
          Contact Admin if corrections are required.
        </div>
      )}

      {/* Gender */}
      <select
        value={gender}
        onChange={(e) => setGender(e.target.value)}
        className={`input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37] bg-black ${profileCompleted ? "opacity-60 cursor-not-allowed" : ""}`}
        disabled={guest || profileCompleted}
      >
        <option value="">Select Gender</option>
        <option value="Male">Male</option>
        <option value="Female">Female</option>
        <option value="Other">Other</option>
      </select>

      {profileCompleted && gender && (
        <div className="text-[10px] text-yellow-400 text-center -mt-3">
          Contact Admin if corrections are required.
        </div>
      )}

      {/* College */}
      <input
        type="text"
        placeholder="College / Company"
        value={college}
        onChange={(e) => setCollege(e.target.value)}
        className="input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37]"
        disabled={guest}
      />

      {/* State dropdown */}
      <select
        value={stateVal}
        onChange={(e) => {
          setStateVal(e.target.value);
          setDistrict("");
          setCity("");
        }}
        className="input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37] bg-black"
        disabled={guest}
      >
        <option value="">Select State</option>
        {indiaStates.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      {/* District dropdown */}
      <select
        value={district}
        onChange={(e) => {
          setDistrict(e.target.value);
          setCity("");
        }}
        className="input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37] bg-black"
        disabled={guest || !stateVal}
      >
        <option value="">Select District</option>
        {selectedStateDistricts.map((d: string) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>

      {/* City dropdown */}
      <select
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37] bg-black"
        disabled={guest || !district}
      >
        <option value="">Select City</option>
        {selectedDistrictCities.map((c: string) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Interests */}
      <input
        type="text"
        placeholder="Interests (Movies, Trips, Food...)"
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        className="input w-72 border-[#D4AF37]/30 focus:border-[#D4AF37]"
        disabled={guest}
      />

      {/* Bio */}
      <textarea
        placeholder="Short Bio"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        className="input w-72 h-20 resize-none border-[#D4AF37]/30 focus:border-[#D4AF37]"
        disabled={guest}
      />

      {/* Save */}
      {!guest && (
        <button
          onClick={saveProfile}
          disabled={saving}
          className="btn-primary mt-2 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      )}

      {/* Verified badge */}
      <div className="text-green-400 text-xs mt-2">✅ Verified Partner Profile</div>

      {/* Trust */}
      <div className="max-w-md text-center text-[11px] text-gray-400 mt-2">
        Your details help us suggest better partners in your city. Payments and purchases always happen directly between partners and providers.
      </div>

      {/* Logout */}
      <button onClick={logout} className="text-red-400 underline text-sm mt-3">
        Logout
      </button>

      {/* Admin */}
      <button onClick={() => (window.location.href = "/admin")} className="text-[10px] opacity-20 mt-1">
        admin
      </button>

      {/* AI */}
      <button onClick={() => (window.location.href = "/ai")} className="mt-4 text-[#D4AF37] text-sm underline">
        Chat with AI 🤖
      </button>
    </div>
  );
}