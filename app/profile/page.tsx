"use client";

import { useState, useEffect } from "react";
import { db, storage, auth } from "@/firebase/config";
import { signOut, onAuthStateChanged, type User } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { resolveExistingUserDoc, normalizePhone } from "@/app/lib/userLookup";
import { indiaStates } from "@/app/data/indiaStates";
import { districts } from "@/app/data/districts";
import { citiesByDistrict } from "@/app/data/cities";
import toast from "react-hot-toast";
import Link from "next/link";

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
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [completedPartnerships, setCompletedPartnerships] = useState(0);
  const [notificationPrefs, setNotificationPrefs] = useState({
    matchAlerts: true,
    paymentAlerts: true,
    chatAlerts: true,
  });

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
        // Force-refresh auth user BEFORE any Firestore operation
        if (auth.currentUser) {
          try {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
          } catch (_) {}
        }

        // Find the EXISTING member doc regardless of its ID format
        // (10-digit phone, +91 phone, raw stored value, or Firebase UID).
        const resolved = await resolveExistingUserDoc(phone);

        if (resolved) {
          // Existing member: the actual doc ID (may be +91/uid-keyed) is kept
          // separate from the canonical phone so matching stays intact while
          // this page reads the real document.
          if (resolved.docId !== phone) {
            localStorage.setItem("phoneDocId", resolved.docId);
          }
          const data = resolved.data as any;
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
          setPaymentVerified(data.paymentVerified === true);
        }

        // Count completed partnerships from paid payments
        const { collection, query, where, getDocs } = await import("firebase/firestore");
        const paymentsQuery = query(
          collection(db, "payments"),
          where("uid", "==", phone),
          where("status", "==", "paid")
        );
        const paySnap = await getDocs(paymentsQuery);
        setCompletedPartnerships(paySnap.size);
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

      // AUTH TIMING FIX: right after OTP login, Firebase Auth may still be
      // restoring the session when the user hits Save. Writing before
      // currentUser exists is ALWAYS denied by the rules ("Missing or
      // insufficient permissions"). Wait briefly for auth to restore and
      // fail with a retryable message instead of attempting a doomed write.
      let currentUser = auth.currentUser;
      if (!currentUser) {
        for (let i = 0; i < 20 && !auth.currentUser; i++) {
          await new Promise((r) => setTimeout(r, 250));
        }
        currentUser = auth.currentUser;
      }
      if (!currentUser) {
        setSaving(false);
        toast.error("Still signing you in… please try again in a moment.");
        return;
      }

      // Force-refresh the token so the rules evaluate fresh auth claims.
      try {
        await currentUser.reload();
        await currentUser.getIdToken(true);
      } catch (_) {}

      const authPhoneRaw = currentUser.phoneNumber || null;
      const authPhone = authPhoneRaw ? authPhoneRaw.replace(/^\+91/, "").trim() : null;
      const authUid = currentUser.uid || null;

      // Resolve the EXISTING member doc first so we update it in place instead
      // of creating a duplicate/new document for a phone that already exists.
      const resolved = await resolveExistingUserDoc(phone);
      const docPhone = resolved?.docId || authPhone || phone;
      const existingData: Record<string, any> = resolved?.data || {};

      // Never overwrite an existing saved value with an empty/default one:
      // empty form fields fall back to whatever the existing doc already has.
      const pick = (value: string, key: string) =>
        value && value.trim() !== "" ? value : existingData[key] ?? "";

      const userRef = doc(db, "users", docPhone);

      /* PRIMARY: server-side save. The route verifies the caller's Firebase
         ID token and writes the profile with the Admin SDK, which is immune
         to the rules' own-doc ID-form edge cases (e.g. Google-login tokens
         without a phone_number claim, or unusual legacy doc IDs). Still
         secure: the caller can only ever write their OWN document. */
      let savedViaServer = false;
      try {
        const idToken = await currentUser.getIdToken(true);
        const res = await fetch("/api/save-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            name: name?.trim() || "",
            gender: gender,
            state: stateVal,
            district: district,
            city: city,
            bio: bio,
            interests: interests,
            college: college,
            photoURL: photoURL || "",
            notificationPrefs,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.docId && data.docId !== docPhone) {
            localStorage.setItem("phoneDocId", data.docId);
          }
          savedViaServer = true;
        } else {
          console.warn("[saveProfile] server save failed:", res.status);
        }
      } catch (serverError: any) {
        console.warn("[saveProfile] server save unavailable, falling back:", serverError?.code || serverError?.message);
      }

      /* FALLBACK: direct Firestore write (kept for resilience when the API
         route is unreachable; works whenever the rules accept this doc-ID
         form — e.g. standard OTP-login users). */
      if (!savedViaServer) {
        await setDoc(
          userRef,
          {
            // FIXED account identity — never overwrite an existing saved value.
            // - phone: preserve the stored identity (existing field wins).
            // - name: preserved forever once saved (existing field wins).
            phone: existingData.phone?.trim() ? existingData.phone : docPhone,
            name: existingData.name?.trim() ? existingData.name : (name?.trim() || ""),
            city: pick(city, "city"),
            district: pick(district, "district"),
            state: pick(stateVal, "state"),
            gender: pick(gender, "gender"),
            bio: pick(bio, "bio"),
            interests: pick(interests, "interests"),
            college: pick(college, "college"),
            photoURL: photoURL || existingData.photoURL || "",
            verified: true,
            profileCompleted: true,
            updatedAt: new Date(),
            // Notification preferences (user-editable)
            notificationPrefs,
          },
          { merge: true }
        );
      }

      // Always keep the canonical phone for matching; the real doc ID is
      // tracked separately so reads/writes hit the same existing document.
      localStorage.setItem("phone", normalizePhone(phone) || phone);
      if (docPhone !== phone) {
        localStorage.setItem("phoneDocId", docPhone);
      }

      toast.success("Profile saved successfully!");
      setProfileCompleted(true);
    } catch (error: any) {
      const code = error?.code || "";
      if (code === "permission-denied") {
        toast.error("Profile save failed: Permission denied. Please re-login and try again.");
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
  const nameLocked = !guest && !!name; // fixed after registration / first save

  return (
    <div className="text-white pt-28 flex flex-col items-center gap-8 px-6 pb-20 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-[#D4AF37] mb-1">Your Profile</h1>

      {/* ===== PROFILE INFORMATION ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Profile Information</h2>

        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="relative">
            <img
              src={photoURL || "https://ui-avatars.com/api/?background=000000&color=D4AF37&name=User"}
              alt="Profile"
              className="w-28 h-28 rounded-full border-4 border-[#D4AF37] object-cover shadow-lg"
            />
          </div>
          {!guest && (
            <label className="cursor-pointer text-sm text-[#D4AF37] underline">
              {uploadLoading ? "Uploading..." : "Upload Profile Photo"}
              <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
            </label>
          )}

          <div className="w-full max-w-xs">
            <div className="flex justify-between text-xs mb-1 text-gray-400">
              <span>Profile Strength</span>
              <span>{profileStrength}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#D4AF37]" style={{ width: `${profileStrength}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Full Name</label>
            <input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              readOnly={nameLocked}
              disabled={guest || nameLocked}
            />
            {nameLocked && (
              <p className="text-[10px] text-gray-500 mt-1.5">🔒 Your name is fixed after saving and cannot be changed.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="input w-full bg-black"
              disabled={guest}
            >
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">College / Company</label>
            <input
              type="text"
              placeholder="College / Company"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              className="input w-full"
              disabled={guest}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Interests (Movies, Trips, Food...)</label>
            <input
              type="text"
              placeholder="Interests"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              className="input w-full"
              disabled={guest}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Short Bio</label>
            <textarea
              placeholder="Short Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="input w-full h-20 resize-none"
              disabled={guest}
            />
          </div>
        </div>
      </section>

      {/* ===== LOCATION ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Location</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">State</label>
            <select
              value={stateVal}
              onChange={(e) => {
                setStateVal(e.target.value);
                setDistrict("");
                setCity("");
              }}
              className="input w-full bg-black"
              disabled={guest}
            >
              <option value="">Select State</option>
              {indiaStates.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">District</label>
            <select
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value);
                setCity("");
              }}
              className="input w-full bg-black"
              disabled={guest || !stateVal}
            >
              <option value="">Select District</option>
              {selectedStateDistricts.map((d: string) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">City</label>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input w-full bg-black"
              disabled={guest || !district}
            >
              <option value="">Select City</option>
              {selectedDistrictCities.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Current matching location */}
          <div className="border border-[#D4AF37]/20 bg-[#D4AF37]/5 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 mb-1">📍 Current Matching Location</p>
            <p className="text-sm font-semibold text-[#FFD166]">
              {city || "—"}, {district || "—"}, {stateVal || "—"}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Your new "Make Partner" matches will use this location. Existing matches stay in My Matches.
            </p>
          </div>
        </div>
      </section>

      {/* ===== NOTIFICATION PREFERENCES ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Notification Preferences</h2>
        <div className="space-y-3">
          {[
            { key: "matchAlerts", label: "Match Alerts", desc: "New compatible partners found" },
            { key: "paymentAlerts", label: "Payment Alerts", desc: "Payment success / failure updates" },
            { key: "chatAlerts", label: "Chat Alerts", desc: "New messages in unlocked chats" },
          ].map((pref) => (
            <label key={pref.key} className="flex items-center justify-between gap-4 bg-white/[0.03] border border-white/10 rounded-xl p-4 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-white">{pref.label}</p>
                <p className="text-xs text-gray-500">{pref.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={(notificationPrefs as any)[pref.key]}
                onChange={(e) =>
                  setNotificationPrefs((prev) => ({ ...prev, [pref.key]: e.target.checked }))
                }
                disabled={guest}
                className="w-5 h-5 accent-[#D4AF37]"
              />
            </label>
          ))}
        </div>
      </section>

      {/* ===== VERIFICATION STATUS ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Verification Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <p className="text-sm font-medium text-white">Phone Verified</p>
              <p className="text-xs text-green-400">✓ Active</p>
            </div>
          </div>
          <div className={`p-4 rounded-xl flex items-center gap-3 ${paymentVerified ? "bg-green-500/5 border border-green-500/20" : "bg-white/[0.02] border border-white/10"}`}>
            <span className="text-2xl">💳</span>
            <div>
              <p className="text-sm font-medium text-white">Payment Verified</p>
              <p className={`text-xs ${paymentVerified ? "text-green-400" : "text-gray-500"}`}>
                {paymentVerified ? "✓ Active" : "Verified after first payment"}
              </p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="text-sm font-medium text-white">Partner Rating</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
          </div>
          <Link href="/trust-safety" className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex items-center gap-3 hover:border-[#D4AF37]/30 transition">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-sm font-medium text-white">Trust & Safety</p>
              <p className="text-xs text-gray-500">View settings →</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ===== PARTNER ACTIVITY ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Partner Activity</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-center">
            <p className="text-2xl font-bold text-blue-400">{completedPartnerships}</p>
            <p className="text-xs text-gray-400 mt-1">Completed Partnerships</p>
          </div>
          <div className="p-4 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-center">
            <p className="text-2xl font-bold text-[#D4AF37]">{profileCompleted ? "✓" : "—"}</p>
            <p className="text-xs text-gray-400 mt-1">Profile Status</p>
          </div>
        </div>
      </section>

      {/* ===== ACCOUNT SETTINGS ===== */}
      <section className="w-full card-premium p-6">
        <h2 className="text-lg font-semibold text-[#FFD166] mb-4">Account Settings</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div>
              <p className="text-sm font-medium text-white">Phone</p>
              <p className="text-xs text-gray-500">+91 {phone || "Not set"}</p>
              <p className="text-[10px] text-gray-600 mt-0.5">Your phone number is your fixed account ID and cannot be changed.</p>
            </div>
            <span className="text-xs text-green-400 font-medium">✓ Verified</span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div>
              <p className="text-sm font-medium text-white">User ID</p>
              <p className="text-xs text-gray-500 font-mono">PS-{(phone || "").replace(/\D/g, "").slice(-5) || "00000"}</p>
            </div>
            <span className="text-[10px] text-gray-600">System-generated</span>
          </div>
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div>
              <p className="text-sm font-medium text-white">Privacy</p>
              <p className="text-xs text-gray-500">Manage trust, reporting & blocking</p>
            </div>
            <Link href="/trust-safety" className="text-xs text-[#D4AF37] hover:underline">
              Manage →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== ACTIONS ===== */}
      {!guest && (
        <button
          onClick={saveProfile}
          disabled={saving}
          className="btn-primary w-full max-w-xs disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
      )}

      <div className="text-green-400 text-xs">✅ Verified Partner Profile</div>

      <button onClick={logout} className="text-red-400 underline text-sm mt-3">
        Logout
      </button>
    </div>
  );
}