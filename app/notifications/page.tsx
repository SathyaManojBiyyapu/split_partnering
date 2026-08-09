"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/firebase/config";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  getDocs,
  limit,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";

type AppNotification = {
  id: string;
  uid: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt?: any;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawPhone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
    setPhone(rawPhone?.trim() || null);
  }, []);

  // Load notifications only for the logged-in user
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const q = query(
          collection(db, "notifications"),
          where("uid", "==", phone),
          orderBy("createdAt", "desc"),
          limit(50)
        );
        const snap = await getDocs(q);
        const items: AppNotification[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...(d.data() as any) });
        });
        setNotifications(items);
      } catch (err) {
        console.error("Error loading notifications:", err);
      }
      setLoading(false);
    };
    load();
  }, [phone]);

  /* Mark individual notification as read */
  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking read:", err);
    }
  }, []);

  /* Mark all as read */
  const markAllAsRead = useCallback(async () => {
    if (!phone) return;
    try {
      const unread = notifications.filter((n) => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, "notifications", n.id), { read: true });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  }, [notifications, phone]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen pt-28 px-6 flex items-center justify-center text-white">
        Loading notifications...
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 px-4 sm:px-6 max-w-3xl mx-auto text-white pb-mobile-cta">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex items-center justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#D4AF37]">Notifications</h1>
          <p className="text-gray-400 text-sm mt-2">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold hover:bg-[#D4AF37]/10 transition"
          >
            Mark All as Read
          </button>
        )}
      </motion.div>

      {notifications.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔔</div>
          <h3 className="text-xl font-semibold text-[#FFD166] mb-2">No notifications yet</h3>
          <p className="text-gray-400 text-sm mb-6">
            You'll be notified when partners match, payments complete, or chats unlock.
          </p>
          <button
            onClick={() => router.push("/categories")}
            className="btn-primary text-sm inline-block"
          >
            Explore Categories
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => markAsRead(n.id)}
              className={`card-premium p-4 cursor-pointer transition-all ${
                n.read ? "opacity-60" : "border-[#D4AF37]/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getTypeIcon(n.type)}</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="text-xs text-gray-400 mt-1">{n.body}</p>
                  {n.createdAt?.seconds && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      {new Date(n.createdAt.seconds * 1000).toLocaleString()}
                    </p>
                  )}
                </div>
                {!n.read && (
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] flex-shrink-0 mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getTypeIcon(type: string): string {
  switch (type) {
    case "new_match":
    case "match_confirmed":
      return "🤝";
    case "group_filled":
      return "✅";
    case "payment_success":
      return "💳";
    case "payment_failed":
      return "❌";
    case "chat_unlocked":
      return "💬";
    case "group_cancelled":
      return "🚫";
    case "partnership_completed":
      return "🏆";
    case "new_message":
      return "✉️";
    default:
      return "🔔";
  }
}