"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import toast from "react-hot-toast"; // ✅ ADDED (ONLY THIS IMPORT)

type Ticket = {
  id: string;
  state: string;
  city: string;
  theatre: string;
  movie: string;
  showDate: string;
  showTime: string;
  quantity: number;
  status: string;
};

export default function AvailableTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  /* FILTER STATES */
  const [city, setCity] = useState("");
  const [movie, setMovie] = useState("");
  const [status, setStatus] = useState("");

  /* LOAD TICKETS */
  const loadTickets = async () => {
    setLoading(true);

    let q = query(collection(db, "movieTickets"));

    if (city) q = query(q, where("city", "==", city));
    if (movie) q = query(q, where("movie", "==", movie));
    if (status) q = query(q, where("status", "==", status));

    const snap = await getDocs(q);

    const data: Ticket[] = snap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as any),
    }));

    setTickets(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  /* CONTACT ADMIN */
  const contactAdmin = async (ticketId: string) => {
    try {
      const buyerPhone =
        typeof window !== "undefined"
          ? localStorage.getItem("phone")
          : null;

      if (!buyerPhone) {
        alert("Please login to continue");
        toast.error("Please login to continue"); // ✅ ADDED
        return;
      }

      await addDoc(collection(db, "ticketRequests"), {
        ticketId,
        buyerPhone: buyerPhone.trim(),
        status: "requested",
        createdAt: serverTimestamp(),
      });

      alert("Admin will contact you shortly.");
      toast.success("Admin will contact you shortly 📞"); // ✅ ADDED
    } catch (err) {
      console.error(err);
      alert("Failed to send request");
      toast.error("Failed to send request ❌"); // ✅ ADDED
    }
  };

  return (
    <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
      <h1 className="text-3xl font-semibold text-[#FFD166] mb-2">
        Available Movie Tickets
      </h1>

      <p className="text-gray-400 mb-8 text-sm">
        Browse tickets and contact admin to proceed
      </p>

      {/* FILTERS */}
      <div className="max-w-5xl mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <input
          placeholder="Filter by City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="neon-input"
        />

        <input
          placeholder="Filter by Movie"
          value={movie}
          onChange={(e) => setMovie(e.target.value)}
          className="neon-input"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="neon-input"
        >
          <option value="">All Status</option>
          <option value="available">Available</option>
          <option value="sold">Sold</option>
        </select>

        <button
          onClick={loadTickets}
          className="
            sm:col-span-3 mt-2 px-6 py-3 rounded-xl font-semibold
            bg-black text-[#E6C972]
            border border-[#E6C972]
            hover:bg-[#F3DC8A]
            hover:text-black
            transition
          "
        >
          Apply Filters
        </button>
      </div>

      {/* LIST */}
      {loading ? (
        <p className="text-gray-400">Loading tickets...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-400">No tickets found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="
                p-6 rounded-2xl
                border border-[#FFD166]/30
                bg-gradient-to-b from-[#0c0c0c] to-black
              "
            >
              <h2 className="text-lg font-semibold text-[#FFD166] mb-2">
                {t.movie}
              </h2>

              <p className="text-sm text-gray-400">🎭 {t.theatre}</p>
              <p className="text-sm text-gray-400">
                📍 {t.city}, {t.state}
              </p>
              <p className="text-sm text-gray-400">
                🕒 {t.showDate} · {t.showTime}
              </p>
              <p className="text-sm text-gray-400">
                🎟️ Quantity: {t.quantity}
              </p>

              <p
                className={`mt-2 text-sm font-medium ${
                  t.status === "available"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {t.status === "available" ? "Available" : "Sold"}
              </p>

              <button
                onClick={() => contactAdmin(t.id)}
                className="
                  w-full mt-4 px-4 py-2 rounded-lg
                  border border-[#FFD166]
                  text-[#FFD166]
                  hover:bg-[#FFD166]
                  hover:text-black
                  transition
                "
              >
                Contact Admin
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
