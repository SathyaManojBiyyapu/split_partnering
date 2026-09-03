"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  addDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const phone = typeof window !== "undefined" ? localStorage.getItem("phone")?.trim() : null;

  /* ---------------- MOUNT ---------------- */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---------------- AUTH ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }
      setFirebaseUser(user);
      if (phone) {
        try {
          await setDoc(
            doc(db, "status", phone),
            { online: true, lastSeen: serverTimestamp() },
            { merge: true }
          );
        } catch {}
      }
    });
    return () => unsub();
  }, [router, phone]);

  /* ---------------- SERVER-SIDE ACCESS VERIFICATION ---------------- */
  useEffect(() => {
    if (!firebaseUser || !groupId) return;

    const verifyAccess = async () => {
      setLoading(true);
      setAccessError(null);
      try {
        const uid = firebaseUser.phoneNumber?.replace(/^\+91/, "").trim() || phone;

        if (!uid) {
          setAccessError("Please login with your phone number.");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/verify-chat-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, groupId }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          setAccessError(data.error || "Chat access denied.");
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setChatId(data.chatId);
        setGroupInfo({
          category: data.category || "",
          option: data.option || "",
          collaboratorBrand: data.collaboratorBrand || "",
          members: data.members || [],
        });
        setAuthorized(true);
        setLoading(false);
      } catch (err) {
        console.error("Chat access verification error:", err);
        setAccessError("Unable to verify chat access. Please try again.");
        setAuthorized(false);
        setLoading(false);
      }
    };

    verifyAccess();
  }, [firebaseUser, groupId, phone]);

  /* ---------------- REALTIME MESSAGES (only after verified access) ---------------- */
  useEffect(() => {
    if (!chatId || !phone || !authorized) return;

    const messagesRef = collection(db, "chats", chatId, "messages");
    const qMessages = query(messagesRef, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      qMessages,
      (snapshot) => {
        const msgs: any[] = [];
        snapshot.forEach((docSnap) => {
          msgs.push({ id: docSnap.id, ...docSnap.data() });
        });
        setMessages(msgs);

        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      (error) => {
        console.error("Messages subscription error:", error);
      }
    );

    return () => unsub();
  }, [chatId, phone, authorized]);

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!newMessage.trim() || !chatId || !phone || !authorized) return;

    try {
      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        text: newMessage,
        senderId: phone,
        senderName: phone.slice(-5),
        senderPhoto: "",
        createdAt: serverTimestamp(),
        seenBy: [phone],
        deleted: false,
        deletedFor: [],
      });

      const chatRef = doc(db, "chats", chatId);
      try {
        await setDoc(chatRef, {
          lastMessage: newMessage,
          lastMessageAt: serverTimestamp(),
        }, { merge: true });
      } catch {}

      setNewMessage("");
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="animate-pulse text-lg text-gray-400">Verifying access...</div>
        </div>
      </div>
    );
  }

  /* ---------------- ACCESS DENIED ---------------- */
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white px-6">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-[#FFD166] mb-2">Chat Locked</h1>
        <p className="text-gray-400 text-sm text-center mb-6 max-w-md">
          {accessError || "This chat requires a verified payment to unlock."}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/payment?groupId=${groupId}`)}
            className="px-6 py-3 rounded-xl bg-[#D4AF37] text-black font-semibold hover:bg-[#E6C97A] transition"
          >
            Complete Payment
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-3 rounded-xl border border-white/20 text-gray-300 hover:bg-white/5 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- CHAT UI ---------------- */
  return (
    <div className="h-dvh bg-black text-white flex flex-col">
      {/* HEADER */}
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-[#E6C972] text-lg font-bold">
            {groupInfo?.option || "Group Chat"}
          </h1>
          <p className="text-xs text-gray-400">
            {groupInfo?.category ? `${groupInfo.category} · ` : ""}
            {groupInfo?.collaboratorBrand ? `${groupInfo.collaboratorBrand} · ` : ""}
            {mounted && onlineUsers.length > 1 ? `${onlineUsers.length} online` : "Private Group"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/trust-safety")}
            className="text-xs text-gray-400 hover:text-[#D4AF37] transition px-2 py-1"
            title="Report / Block"
          >
            🛡️
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-gray-400 hover:text-white"
          >
            Back
          </button>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-400 text-sm">No messages yet. Say hello to your partners!</p>
            <p className="text-gray-600 text-xs mt-1">Identity is masked until you mutually share details.</p>
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.senderId === phone;
          const time = mounted && msg.createdAt?.seconds
            ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : "";

          if (msg.deletedFor?.includes(phone)) return null;

          return (
            <div
              key={msg.id}
              className={`relative p-3 rounded-xl max-w-xs ${
                isMine ? "bg-[#E6C972] text-black ml-auto" : "bg-gray-700 text-white"
              }`}
            >
              {msg.deleted ? (
                <div className="italic text-gray-400">🚫 This message was deleted</div>
              ) : (
                <div>
                  <div className="text-xs opacity-70 mb-1">{msg.senderName || "User"}</div>
                  <div>{msg.text}</div>
                </div>
              )}
              <div className="text-xs mt-2 flex justify-between items-center">
                <span>{time}</span>
                {isMine && <span>{msg.seenBy?.length > 1 ? "✔✔" : "✔"}</span>}
              </div>
            </div>
          );
        })}

        {typingUsers.length > 0 && (
          <div className="text-sm italic text-gray-400">Someone is typing...</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 border-t border-gray-700 flex gap-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type message..."
          className="flex-1 p-3 rounded-lg bg-gray-800 text-white outline-none focus:border-[#D4AF37] border border-transparent transition"
        />
        <button
          onClick={sendMessage}
          className="px-5 py-3 rounded-lg bg-[#E6C972] text-black font-semibold hover:scale-105 transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}