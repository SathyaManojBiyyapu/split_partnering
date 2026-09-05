// Hook to get the logged-in user's location (state, district, city) from Firestore

"use client";

import { useState, useEffect } from "react";
import { db } from "@/firebase/config";
import { fetchCurrentUserDoc } from "@/app/lib/userLookup";

export interface UserLocation {
  state: string;
  district: string;
  city: string;
  loading: boolean;
  error: string | null;
  phone: string | null;
  userName: string;
  userEmail: string;
}

export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>({
    state: "",
    district: "",
    city: "",
    loading: true,
    error: null,
    phone: null,
    userName: "",
    userEmail: "",
  });

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const phone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;

        if (!phone) {
          setLocation((prev) => ({
            ...prev,
            loading: false,
            error: "User not logged in",
          }));
          return;
        }

        // Resilient read: resolves the real doc ID (phone/+91/UID forms) and
        // falls back to the indexed phone query when a direct getDoc is denied
        // by the own-doc rules (e.g. Google-login doc-ID edge cases).
        const resolved = await fetchCurrentUserDoc();

        if (resolved) {
          const data = resolved.data as any;
          // Keep the resolved doc ID cached so later direct reads on this
          // session hit the right document.
          if (resolved.docId !== phone) {
            localStorage.setItem("phoneDocId", resolved.docId);
          }
          setLocation({
            state: data.state || "",
            district: data.district || "",
            city: data.city || "",
            loading: false,
            error: null,
            phone,
            userName: data.name || "",
            userEmail: data.email || "",
          });
        } else {
          setLocation((prev) => ({
            ...prev,
            loading: false,
            error: "User profile not found. Please complete your profile.",
          }));
        }
      } catch (err: any) {
        console.error("Error fetching user location:", err);
        setLocation((prev) => ({
          ...prev,
          loading: false,
          error: err.message || "Failed to fetch location",
        }));
      }
    };

    fetchLocation();
  }, []);

  return location;
}