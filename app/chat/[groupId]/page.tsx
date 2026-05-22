"use client";

import {
  useEffect,
  useState,
  useRef,
} from "react";

import {
  useRouter,
  useParams,
} from "next/navigation";

import {
  auth,
  db,
} from "@/firebase/config";

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
  getDoc,
  arrayUnion,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

export default function ChatPage() {

  const router =
    useRouter();

  const params =
    useParams();

  const groupId =
    params.groupId as string;

  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState<any>(null);

  const [
    chatId,
    setChatId,
  ] = useState<string | null>(
    null
  );

  const [
    messages,
    setMessages,
  ] = useState<any[]>(
    []
  );

  const [
    newMessage,
    setNewMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    typingUsers,
    setTypingUsers,
  ] = useState<string[]>(
    []
  );

  const [
    onlineUsers,
    setOnlineUsers,
  ] = useState<string[]>(
    []
  );

  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [
    groupMembers,
    setGroupMembers,
  ] = useState<any[]>(
    []
  );

  const bottomRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /* PHONE UID */

  const phone =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "phone"
        )?.trim()
      : null;

  /* ---------------- MOUNT ---------------- */

  useEffect(() => {

    setMounted(true);

  }, []);

  /* ---------------- AUTH ---------------- */

  useEffect(() => {

    const unsub =
      onAuthStateChanged(
        auth,
        async (user) => {

          if (!user) {

            router.push(
              "/login"
            );

            return;
          }

          setFirebaseUser(
            user
          );

          if (phone) {

            await setDoc(
              doc(
                db,
                "status",
                phone
              ),
              {
                online: true,

                lastSeen:
                  serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          }
        }
      );

    return () =>
      unsub();

  }, [router, phone]);

  /* ---------------- VERIFY ACCESS ---------------- */

  useEffect(() => {

    if (
      !firebaseUser ||
      !groupId ||
      !phone
    )
      return;

    const verifyAccess =
      async () => {

        try {

          /* PAYMENT */

          const paymentsRef =
            collection(
              db,
              "payments"
            );

          const qPay =
            query(
              paymentsRef,

              where(
                "uid",
                "==",
                phone
              ),

              where(
                "groupId",
                "==",
                groupId
              ),

              where(
                "status",
                "==",
                "paid"
              )
            );

          const paySnap =
            await getDocs(
              qPay
            );

          if (
            paySnap.empty
          ) {

            router.push(
              "/dashboard"
            );

            return;
          }

          /* GROUP */

          const groupRef =
            doc(
              db,
              "groups",
              groupId
            );

          const groupSnap =
            await getDoc(
              groupRef
            );

          if (
            !groupSnap.exists()
          ) {

            router.push(
              "/dashboard"
            );

            return;
          }

          const groupData =
            groupSnap.data();

          const members =
            groupData.members ||
            [];

          setGroupMembers(
            members
          );

          const isMember =
            members.some(
              (
                m: any
              ) => {

                if (
                  typeof m ===
                  "string"
                ) {

                  return (
                    m.trim() ===
                    phone
                  );
                }

                return (
                  m?.phone
                    ?.trim() ===
                  phone
                );
              }
            ) ||

            groupData.memberUIDs?.includes(
              phone
            );

          if (
            !isMember
          ) {

            router.push(
              "/dashboard"
            );

            return;
          }

          /* CHAT */

          const chatsRef =
            collection(
              db,
              "chats"
            );

          const qChat =
            query(
              chatsRef,

              where(
                "groupId",
                "==",
                groupId
              )
            );

          const chatSnap =
            await getDocs(
              qChat
            );

          if (
            chatSnap.empty
          ) {

            router.push(
              "/dashboard"
            );

            return;
          }

          const chatDoc =
            chatSnap.docs[0];

          setChatId(
            chatDoc.id
          );

          setAuthorized(
            true
          );

          setLoading(
            false
          );

        } catch (error) {

          console.error(
            "Verify access error:",
            error
          );

          router.push(
            "/dashboard"
          );
        }
      };

    verifyAccess();

  }, [
    firebaseUser,
    groupId,
    router,
    phone,
  ]);

  /* ---------------- REALTIME MESSAGES ---------------- */

  useEffect(() => {

    if (
      !chatId ||
      !phone
    )
      return;

    const messagesRef =
      collection(
        db,
        "chats",
        chatId,
        "messages"
      );

    const qMessages =
      query(
        messagesRef,

        orderBy(
          "createdAt",
          "asc"
        )
      );

    const unsub =
      onSnapshot(
        qMessages,
        async (
          snapshot
        ) => {

          const msgs: any[] =
            [];

          snapshot.forEach(
            (
              docSnap
            ) => {

              msgs.push({
                id:
                  docSnap.id,

                ...docSnap.data(),
              });
            }
          );

          setMessages(
            msgs
          );

          /* AUTO SCROLL */

          setTimeout(() => {

            bottomRef.current?.scrollIntoView(
              {
                behavior:
                  "smooth",
              }
            );

          }, 100);

          /* SEEN STATUS */

          for (const msg of msgs) {

            if (
              msg.senderId !==
                phone &&
              (!msg.seenBy ||
                !msg.seenBy.includes(
                  phone
                ))
            ) {

              try {

                const msgRef =
                  doc(
                    db,
                    "chats",
                    chatId,
                    "messages",
                    msg.id
                  );

                await updateDoc(
                  msgRef,
                  {
                    seenBy:
                      arrayUnion(
                        phone
                      ),
                  }
                );

              } catch {}
            }
          }
        }
      );

    return () =>
      unsub();

  }, [
    chatId,
    phone,
  ]);

  /* ---------------- ONLINE USERS ---------------- */

  useEffect(() => {

    const statusRef =
      collection(
        db,
        "status"
      );

    const unsub =
      onSnapshot(
        statusRef,
        (
          snapshot
        ) => {

          const users:
            string[] =
            [];

          snapshot.forEach(
            (
              docSnap
            ) => {

              const data =
                docSnap.data();

              if (
                data.online
              ) {

                users.push(
                  docSnap.id
                );
              }
            }
          );

          setOnlineUsers(
            users
          );
        }
      );

    return () =>
      unsub();

  }, []);

  /* ---------------- TYPING ---------------- */

  useEffect(() => {

    if (
      !chatId ||
      !phone
    )
      return;

    const typingRef =
      collection(
        db,
        "chats",
        chatId,
        "typing"
      );

    const unsub =
      onSnapshot(
        typingRef,
        (
          snapshot
        ) => {

          const users:
            string[] =
            [];

          snapshot.forEach(
            (
              docSnap
            ) => {

              const data =
                docSnap.data();

              if (
                docSnap.id !==
                  phone &&
                data.typing
              ) {

                users.push(
                  docSnap.id
                );
              }
            }
          );

          setTypingUsers(
            users
          );
        }
      );

    return () =>
      unsub();

  }, [
    chatId,
    phone,
  ]);

  /* ---------------- HANDLE TYPING ---------------- */

  const handleTyping =
    async (
      value: string
    ) => {

      setNewMessage(
        value
      );

      if (
        !chatId ||
        !phone
      )
        return;

      try {

        const typingDoc =
          doc(
            db,
            "chats",
            chatId,
            "typing",
            phone
          );

        await setDoc(
          typingDoc,
          {
            typing:
              value.trim()
                .length > 0,
          },
          {
            merge: true,
          }
        );

      } catch {}
    };

  /* ---------------- SEND MESSAGE ---------------- */

  const sendMessage =
    async () => {

      if (
        !newMessage.trim() ||
        !chatId ||
        !phone
      )
        return;

      try {

        const myMember =
          groupMembers.find(
            (
              m: any
            ) =>
              m?.phone ===
              phone
          );

        const messagesRef =
          collection(
            db,
            "chats",
            chatId,
            "messages"
          );

        await addDoc(
          messagesRef,
          {
            text:
              newMessage,

            senderId:
              phone,

            senderName:
              myMember?.name ||
              firebaseUser?.displayName ||
              phone,

            senderPhoto:
              myMember?.photoURL ||
              "",

            createdAt:
              serverTimestamp(),

            seenBy: [
              phone,
            ],

            deleted:
              false,

            deletedFor:
              [],
          }
        );

        const chatRef =
          doc(
            db,
            "chats",
            chatId
          );

        await updateDoc(
          chatRef,
          {
            lastMessage:
              newMessage,

            lastMessageAt:
              serverTimestamp(),
          }
        );

        setNewMessage("");

        const typingDoc =
          doc(
            db,
            "chats",
            chatId,
            "typing",
            phone
          );

        await setDoc(
          typingDoc,
          {
            typing: false,
          },
          {
            merge: true,
          }
        );

      } catch (error) {

        console.error(
          "Send message error:",
          error
        );
      }
    };

  /* ---------------- LOADING ---------------- */

  if (loading) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Loading chat...
      </div>
    );
  }

  if (!authorized) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        Unauthorized
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">

      {/* HEADER */}

      <div className="p-4 border-b border-gray-700 flex justify-between items-center">

        <div>

          <h1 className="text-[#E6C972] text-xl font-bold">
            Partner Sync Chat
          </h1>

          <p className="text-sm text-green-400">

            {onlineUsers.length >
            1
              ? `${onlineUsers.length} members online`
              : "Private Group"}

          </p>

        </div>

        <button
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          className="text-sm text-gray-400 hover:text-white"
        >
          Back
        </button>

      </div>

      {/* MESSAGES */}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {messages.map(
          (
            msg
          ) => {

            const isMine =
              msg.senderId ===
              phone;

            const time =
              mounted &&
              msg.createdAt
                ?.seconds
                ? new Date(
                    msg.createdAt.seconds *
                      1000
                  ).toLocaleTimeString(
                    [],
                    {
                      hour:
                        "2-digit",

                      minute:
                        "2-digit",
                    }
                  )
                : "";

            if (
              msg.deletedFor?.includes(
                phone
              )
            ) {

              return null;
            }

            return (
              <div
                key={
                  msg.id
                }
                className={`relative group p-3 rounded-xl max-w-xs flex gap-3 ${
                  isMine
                    ? "bg-[#E6C972] text-black ml-auto"
                    : "bg-gray-700 text-white"
                }`}
              >

                <img
                  src={
                    msg.senderPhoto ||
                    "https://ui-avatars.com/api/?background=000000&color=FFD166&name=User"
                  }
                  alt="user"
                  className="w-9 h-9 rounded-full border border-[#FFD166]"
                />

                <div className="flex-1">

                  {msg.deleted ? (

                    <div className="italic text-gray-400">
                      🚫 This message was deleted
                    </div>

                  ) : (

                    <div>

                      <div className="text-xs opacity-70 mb-1">
                        {
                          msg.senderName
                        }
                      </div>

                      <div>
                        {
                          msg.text
                        }
                      </div>

                    </div>
                  )}

                  <div className="text-xs mt-2 flex justify-between items-center">

                    <span>
                      {time}
                    </span>

                    {isMine && (

                      <span>

                        {msg.seenBy
                          ?.length >
                        1
                          ? "✔✔"
                          : "✔"}

                      </span>
                    )}

                  </div>

                </div>

              </div>
            );
          }
        )}

        {typingUsers.length >
          0 && (

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
          value={
            newMessage
          }
          onChange={(
            e
          ) =>
            handleTyping(
              e.target.value
            )
          }
          placeholder="Type message..."
          className="flex-1 p-3 rounded-lg bg-gray-800 text-white outline-none"
        />

        <button
          onClick={
            sendMessage
          }
          className="px-5 py-3 rounded-lg bg-[#E6C972] text-black font-semibold hover:scale-105 transition"
        >
          Send
        </button>

      </div>

    </div>
  );
}