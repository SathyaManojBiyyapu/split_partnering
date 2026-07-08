// Hook to get the logged-in user's location (state, district, city) from Firestore

"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/firebase/config";

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

        const userRef = doc(db, "users", phone);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const data = snap.data() as any;
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