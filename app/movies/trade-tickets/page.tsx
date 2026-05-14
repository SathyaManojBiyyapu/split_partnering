"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/firebase/config";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import toast from "react-hot-toast"; // ✅ ADDED (ONLY THIS IMPORT)

export default function TradeTicketsPage() {
  const router = useRouter();

  /* 🔐 AUTH STATE */
  const [phone, setPhone] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedPhone = localStorage.getItem("phone");

    if (!storedPhone) {
      alert("Please login to trade tickets");
      toast.error("Please login to trade tickets"); // ✅ ADDED
      router.push("/login");
      return;
    }

    setPhone(storedPhone.trim());
    setAuthChecked(true);
  }, [router]);

  /* FORM STATE */
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [theatre, setTheatre] = useState("");
  const [movie, setMovie] = useState("");
  const [showDate, setShowDate] = useState("");
  const [showTime, setShowTime] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  /* BLOCK UI UNTIL AUTH CHECK */
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#FFD166]">
        Checking login…
      </div>
    );
  }

  /* SUBMIT */
  const handleSubmit = async () => {
    if (loading) return;

    if (
      !state.trim() ||
      !city.trim() ||
      !theatre.trim() ||
      !movie.trim() ||
      !showDate ||
      !showTime ||
      quantity < 1
    ) {
      alert("Please fill all fields");
      toast.error("Please fill all fields"); // ✅ ADDED
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "movieTickets"), {
        sellerPhone: phone,
        state: state.trim(),
        city: city.trim(),
        theatre: theatre.trim(),
        movie: movie.trim(),
        showDate,
        showTime,
        quantity,
        status: "available",
        createdAt: serverTimestamp(),
      });

      alert("Ticket listed successfully!");
      toast.success("Ticket listed successfully 🎟️"); // ✅ ADDED
      router.push("/movies/available-tickets");
    } catch (err) {
      console.error(err);
      alert("Failed to save ticket");
      toast.error("Failed to save ticket ❌"); // ✅ ADDED
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
      <h1 className="text-3xl font-semibold text-[#FFD166] mb-2">
        Trade Movie Tickets
      </h1>

      <p className="text-gray-400 mb-8 text-sm">
        Enter ticket details to make them available
      </p>

      {/* FORM */}
      <div className="max-w-xl space-y-4">
        <input
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full neon-input"
        />

        <input
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="w-full neon-input"
        />

        <input
          placeholder="Theatre Name"
          value={theatre}
          onChange={(e) => setTheatre(e.target.value)}
          className="w-full neon-input"
        />

        <input
          placeholder="Movie Name"
          value={movie}
          onChange={(e) => setMovie(e.target.value)}
          className="w-full neon-input"
        />

        <input
          type="date"
          value={showDate}
          onChange={(e) => setShowDate(e.target.value)}
          className="w-full neon-input"
        />

        <input
          type="time"
          value={showTime}
          onChange={(e) => setShowTime(e.target.value)}
          className="w-full neon-input"
        />

        <input
          type="number"
          min={1}
          placeholder="Ticket Quantity"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full neon-input"
        />

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="
            w-full mt-4 px-6 py-3 rounded-xl font-semibold
            bg-black text-[#E6C972]
            border border-[#E6C972]
            shadow-[0_0_18px_rgba(230,201,114,0.75)]
            hover:bg-[#F3DC8A]
            hover:text-black
            disabled:opacity-60
            transition
          "
        >
          {loading ? "Saving..." : "List Tickets"}
        </button>

        {/* BACK */}
        <button
          onClick={() => router.push("/categories")}
          className="block text-[#FFD166] text-sm mt-4 hover:underline"
        >
          ← Back to Categories
        </button>
      </div>
    </div>
  );
}
