"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
} from "firebase/firestore";

/* ✅ ADDED: FORMAT DATE & TIME (UI ONLY) */
const formatDateTime = (ts: any) => {
  if (!ts?.seconds) return "N/A";
  const d = new Date(ts.seconds * 1000);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
};

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
  sellerPhone: string;
};

type Request = {
  id: string;
  ticketId: string;
  buyerPhone?: string;
  status: string;
  createdAt?: any; // ✅ already exists in DB
};

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  /* LOAD DATA */
  const loadData = async () => {
    setLoading(true);

    const ticketsSnap = await getDocs(
      query(collection(db, "movieTickets"), orderBy("createdAt", "desc"))
    );

    const reqSnap = await getDocs(
      query(collection(db, "ticketRequests"), orderBy("createdAt", "desc"))
    );

    setTickets(
      ticketsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );

    setRequests(
      reqSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }))
    );

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  /* MARK SOLD */
  const markSold = async (id: string) => {
    if (!confirm("Mark this ticket as SOLD?")) return;

    await updateDoc(doc(db, "movieTickets", id), {
      status: "sold",
    });

    loadData();
  };

  if (loading) {
    return <p className="text-gray-400 p-10">Loading admin tickets...</p>;
  }

  return (
    <div className="min-h-screen pt-28 px-6 bg-black text-[#F5F5F5]">
      <h1 className="text-3xl font-semibold text-[#FFD166] mb-6">
        🎬 Admin — Movie Tickets
      </h1>

      {/* REQUESTS */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-[#FFD166] mb-4">
          Buyer Requests
        </h2>

        {requests.length === 0 ? (
          <p className="text-gray-400">No requests yet</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-xl border border-[#FFD166]/30 bg-[#0c0c0c]"
              >
                <p className="text-sm text-gray-300">
                  <span className="text-[#FFD166]">Request ID:</span> {r.id}
                </p>

                <p className="text-sm text-gray-300">
                  <span className="text-[#FFD166]">Ticket ID:</span>{" "}
                  {r.ticketId}
                </p>

                <p className="text-sm text-gray-300">
                  <span className="text-[#FFD166]">Buyer Phone:</span>{" "}
                  {r.buyerPhone ?? "N/A"}
                </p>

                {/* ✅ ADDED: BOOKING DATE & TIME */}
                <p className="text-xs text-gray-400 mt-1">
                  📅 {formatDateTime(r.createdAt)}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Status: {r.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TICKETS */}
      <h2 className="text-xl font-semibold text-[#FFD166] mb-4">
        All Listed Tickets
      </h2>

      {tickets.length === 0 ? (
        <p className="text-gray-400">No tickets listed</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="p-6 rounded-2xl border border-[#FFD166]/30 bg-gradient-to-b from-[#0c0c0c] to-black"
            >
              <h3 className="text-lg font-semibold text-[#FFD166] mb-2">
                {t.movie}
              </h3>

              <p className="text-sm text-gray-400">🎭 {t.theatre}</p>
              <p className="text-sm text-gray-400">
                📍 {t.city}, {t.state}
              </p>
              <p className="text-sm text-gray-400">
                🕒 {t.showDate} · {t.showTime}
              </p>
              <p className="text-sm text-gray-400">
                🎟️ Qty: {t.quantity}
              </p>
              <p className="text-sm text-gray-400">
                📞 Seller: {t.sellerPhone}
              </p>

              <p
                className={`mt-2 font-medium ${
                  t.status === "available"
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {t.status.toUpperCase()}
              </p>

              {t.status === "available" && (
                <button
                  onClick={() => markSold(t.id)}
                  className="w-full mt-4 px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Mark as Sold
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
