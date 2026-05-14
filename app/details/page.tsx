"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function MyDetailsPage() {
  const router = useRouter();

  const phone =
    typeof window !== "undefined" ? localStorage.getItem("phone") : null;

  const guest =
    typeof window !== "undefined"
      ? localStorage.getItem("guest") === "true"
      : false;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  /* -----------------------------------------
      PROTECT PAGE
  ------------------------------------------*/
  useEffect(() => {
    if (guest) {
      alert("Guest mode cannot view full details. Please login.");
      router.push("/login");
    }

    if (!phone) {
      router.push("/login");
    }
  }, [guest, phone]);

  /* -----------------------------------------
      LOAD PROFILE
  ------------------------------------------*/
  useEffect(() => {
    const loadProfile = async () => {
      if (!phone) return;

      const userRef = doc(db, "users", phone);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        setProfile(snap.data());
      }

      setLoading(false);
    };

    loadProfile();
  }, [phone]);

  if (loading) {
    return (
      <div className="pt-32 text-center text-gray-300">
        Loading your details…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-32 text-center text-gray-300">
        No details found.  
        <button
          onClick={() => router.push("/profile")}
          className="block mt-4 text-[#16FF6E] underline"
        >
          Add Details →
        </button>
      </div>
    );
  }

  /* -----------------------------------------
      RENDER MAIN DETAILS
  ------------------------------------------*/
  return (
    <div className="min-h-screen pt-28 px-6 text-white">
      <h1 className="text-3xl font-bold text-[#16FF6E] mb-4">
        My Details
      </h1>

      <p className="text-gray-400 text-sm mb-8">
        Your saved information is shown here.
      </p>

      <div className="space-y-4 max-w-md">

        <Detail label="Phone Number" value={profile.phone} />
        <Detail label="Full Name" value={profile.name || "—"} />
        <Detail label="City" value={profile.city || "—"} />
        <Detail label="State" value={profile.state || "—"} />
        <Detail label="Country" value={profile.country || "—"} />

        <Detail
          label="Last Updated"
          value={
            profile.updatedAt?.toDate
              ? profile.updatedAt.toDate().toLocaleString()
              : "—"
          }
        />
      </div>

      {/* BUTTONS */}
      <div className="flex flex-col gap-4 mt-10 max-w-sm">

        <button
          onClick={() => router.push("/profile")}
          className="px-6 py-3 bg-[#16FF6E] text-black rounded-xl font-semibold hover:bg-white transition"
        >
          Edit Profile
        </button>

        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-[#16FF6E]/10 border border-[#16FF6E]/50 rounded-xl text-[#16FF6E] hover:bg-[#16FF6E] hover:text-black transition"
        >
          ← Back to Home
        </button>

        <button
          onClick={() => router.push("/ai")}
          className="px-6 py-3 bg-[#16FF6E] text-black rounded-xl font-semibold hover:bg-white transition"
        >
          Ask AI 🤖
        </button>

      </div>
    </div>
  );
}

/* -----------------------------------------
   SIMPLE DETAIL BOX COMPONENT
------------------------------------------*/
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-black/40 border border-[#16FF6E]/20 rounded-xl">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-[#16FF6E]">{value}</p>
    </div>
  );
}
