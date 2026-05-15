"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/firebase/config";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();

  const groupId = params.groupId as string;

  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [loading, setLoading] = useState(true);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const [mounted, setMounted] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  /* ---------------- MOUNT FIX ---------------- */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* ---------------- AUTH CHECK ---------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      setFirebaseUser(user);

      await setDoc(
        doc(db, "status", user.uid),
        {
          online: true,
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    });

    return () => unsub();
  }, [router]);

  /* ---------------- VERIFY ACCESS ---------------- */
  useEffect(() => {
    if (!firebaseUser || !groupId) return;

    const verifyAccess = async () => {
      try {
        const paymentsRef = collection(db, "payments");

        const qPay = query(
          paymentsRef,
          where("uid", "==", firebaseUser.uid),
          where("groupId", "==", groupId),
          where("status", "==", "paid")
        );

        const paySnap = await getDocs(qPay);

        if (paySnap.empty) {
          router.push("/dashboard");
          return;
        }

        const chatsRef = collection(db, "chats");

        const qChat = query(
          chatsRef,
          where("groupId", "==", groupId)
        );

        const chatSnap = await getDocs(qChat);

        if (chatSnap.empty) {
          router.push("/dashboard");
          return;
        }

        const chatDoc = chatSnap.docs[0];

        setChatId(chatDoc.id);
        setLoading(false);
      } catch (error) {
        console.error("Verify access error:", error);
      }
    };

    verifyAccess();
  }, [firebaseUser, groupId, router]);

  /* ---------------- LOAD MESSAGES ---------------- */
  useEffect(() => {
    if (!chatId || !firebaseUser) return;

    const messagesRef = collection(
      db,
      "chats",
      chatId,
      "messages"
    );

    const qMessages = query(
      messagesRef,
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(qMessages, async (snapshot) => {
      const msgs: any[] = [];

      snapshot.forEach((docSnap) => {
        msgs.push({
          id: docSnap.id,
          ...docSnap.data(),
        });
      });

      setMessages(msgs);

      for (const msg of msgs) {
        if (
          msg.senderId !== firebaseUser.uid &&
          (!msg.seenBy ||
            !msg.seenBy.includes(firebaseUser.uid))
        ) {
          try {
            const msgRef = doc(
              db,
              "chats",
              chatId,
              "messages",
              msg.id
            );

            await updateDoc(msgRef, {
              seenBy: [
                ...(msg.seenBy || []),
                firebaseUser.uid,
              ],
            });
          } catch (error) {
            console.error("Seen update error:", error);
          }
        }
      }
    });

    return () => unsub();
  }, [chatId, firebaseUser]);

  /* ---------------- TYPING STATUS ---------------- */
  useEffect(() => {
    if (!chatId) return;

    const typingRef = collection(
      db,
      "chats",
      chatId,
      "typing"
    );

    const unsub = onSnapshot(typingRef, (snapshot) => {
      const users: string[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        if (
          docSnap.id !== firebaseUser?.uid &&
          data.typing
        ) {
          users.push(docSnap.id);
        }
      });

      setTypingUsers(users);
    });

    return () => unsub();
  }, [chatId, firebaseUser]);

  /* ---------------- HANDLE TYPING ---------------- */
  const handleTyping = async (value: string) => {
    setNewMessage(value);

    if (!chatId || !firebaseUser) return;

    try {
      const typingDoc = doc(
        db,
        "chats",
        chatId,
        "typing",
        firebaseUser.uid
      );

      await setDoc(
        typingDoc,
        {
          typing: value.trim().length > 0,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Typing error:", error);
    }
  };

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (
      !newMessage.trim() ||
      !chatId ||
      !firebaseUser
    )
      return;

    try {
      const messagesRef = collection(
        db,
        "chats",
        chatId,
        "messages"
      );

      await addDoc(messagesRef, {
        text: newMessage,
        senderId: firebaseUser.uid,
        createdAt: serverTimestamp(),
        seenBy: [firebaseUser.uid],
        deleted: false,
        deletedFor: [],
      });

      setNewMessage("");

      const typingDoc = doc(
        db,
        "chats",
        chatId,
        "typing",
        firebaseUser.uid
      );

      await setDoc(
        typingDoc,
        {
          typing: false,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Send message error:", error);
    }
  };

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /* ---------------- LOADING ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* HEADER */}
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-[#E6C972] text-xl font-bold">
          Partner Sync Chat
        </h1>

        <p className="text-sm text-green-400">
          {onlineUsers.length > 1
            ? "Members Online"
            : "Offline"}
        </p>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine =
            msg.senderId === firebaseUser?.uid;

          const time =
            mounted && msg.createdAt?.seconds
              ? new Date(
                  msg.createdAt.seconds * 1000
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";

          const handleDeleteForEveryone =
            async () => {
              if (!chatId) return;

              try {
                const msgRef = doc(
                  db,
                  "chats",
                  chatId,
                  "messages",
                  msg.id
                );

                await updateDoc(msgRef, {
                  text: "This message was deleted",
                  deleted: true,
                });
              } catch (error) {
                console.error(
                  "Delete for everyone error:",
                  error
                );
              }
            };

          const handleDeleteForMe = async () => {
            if (!chatId) return;

            try {
              const msgRef = doc(
                db,
                "chats",
                chatId,
                "messages",
                msg.id
              );

              await updateDoc(msgRef, {
                deletedFor: [
                  ...(msg.deletedFor || []),
                  firebaseUser.uid,
                ],
              });
            } catch (error) {
              console.error(
                "Delete for me error:",
                error
              );
            }
          };

          if (
            msg.deletedFor?.includes(
              firebaseUser.uid
            )
          ) {
            return null;
          }

          return (
            <div
              key={msg.id}
              className={`relative group p-3 rounded-xl max-w-xs ${
                isMine
                  ? "bg-[#E6C972] text-black ml-auto"
                  : "bg-gray-700 text-white"
              }`}
            >
              {msg.deleted ? (
                <div className="italic text-gray-400">
                  🚫 This message was deleted
                </div>
              ) : (
                <div>{msg.text}</div>
              )}

              <div className="text-xs mt-2 flex justify-between items-center">
                <span>{time}</span>

                {isMine && (
                  <span>
                    {msg.seenBy?.length > 1
                      ? "✔✔"
                      : "✔"}
                  </span>
                )}
              </div>

              {isMine && !msg.deleted && (
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-2 text-xs">
                  <button
                    onClick={handleDeleteForMe}
                    className="text-yellow-400"
                  >
                    Delete Me
                  </button>

                  <button
                    onClick={handleDeleteForEveryone}
                    className="text-red-400"
                  >
                    Delete All
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* TYPING */}
        {typingUsers.length > 0 && (
          <div className="text-sm italic text-gray-400">
            Someone is typing...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <div className="p-4 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) =>
            handleTyping(e.target.value)
          }
          placeholder="Type message..."
          className="flex-1 p-2 rounded-lg bg-gray-800 text-white outline-none"
        />

        <button
          onClick={sendMessage}
          className="px-4 py-2 rounded-lg bg-[#E6C972] text-black font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}