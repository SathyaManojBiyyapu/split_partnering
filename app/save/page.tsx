"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/firebase/config";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { partneringInfo } from "@/app/data/partneringInfo";

/* -----------------------------------------
   GROUP SIZE
------------------------------------------*/
const GROUP_SIZE: Record<string, number> = {
  split: 2,
  pass: 2,
  supplements: 3,
  "peter-england": 2,
  "louis-philippe": 2,
  unlimited: 2,
  trends: 2,
  wrogn: 2,
  wildcraft: 2,
  zara: 2,
  hm: 2,
  nike: 2,
  adidas: 2,
  "save-ticket": 2,
  "bulk-ticket": 2,
  splitbuy: 2,
  "lens-split": 2,
  car: 4,
  bike: 2,
  "couple-entry": 2,
  "group-save": 4,
  "best-deals": 2,
  "gift-card": 2,
  room: 6,
  weekend: 4,
  java: 2,
  python: 2,
  c: 2,
  dsa: 2,
  oops: 2,
  cn: 2,
  dbms: 2,
  os: 2,
  "previous-papers": 2,
};

const getRequiredSize = (opt: string) => GROUP_SIZE[opt] || 2;

/* -----------------------------------------
   CREATE OR JOIN GROUP (UNCHANGED)
------------------------------------------*/
async function createOrJoinGroup(category: string, option: string, rawPhone: string) {
  const cleanPhone = rawPhone.trim();
  const groupsRef = collection(db, "groups");

  const q = query(
    groupsRef,
    where("category", "==", category),
    where("option", "==", option)
  );

  const snap = await getDocs(q);

  for (const gdoc of snap.docs) {
    const g = gdoc.data();
    const members: string[] = g.members || [];
    const required = g.requiredSize || getRequiredSize(option);

    if (members.includes(cleanPhone)) {
      return { status: "already", membersCount: members.length };
    }

    if (members.length < required) {
      const gRef = doc(db, "groups", gdoc.id);

      await updateDoc(gRef, {
        members: arrayUnion(cleanPhone),
        membersCount: members.length + 1,
      });

      const updated = (await getDoc(gRef)).data() as any;
      const updatedMembers = updated.members || [];

      if (updatedMembers.length >= required) {
        await updateDoc(gRef, {
          status: "ready",
          readyAt: serverTimestamp(),
        });
      }

      return { status: "joined", membersCount: updatedMembers.length };
    }
  }

  const newGroupRef = doc(groupsRef);
  const required = getRequiredSize(option);

  await setDoc(newGroupRef, {
    category,
    option,
    members: [cleanPhone],
    membersCount: 1,
    requiredSize: required,
    status: "waiting",
    createdAt: serverTimestamp(),
  });

  return { status: "created", membersCount: 1 };
}

/* -----------------------------------------
   SAVE CONTENT UI (STYLE UPDATED)
------------------------------------------*/
function SaveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const category = searchParams.get("category") || "";
  const option = searchParams.get("option") || "";

  const rawPhone =
    typeof window !== "undefined" ? localStorage.getItem("phone") : null;

  const phone = rawPhone ? rawPhone.trim() : null;

  const isGuest =
    typeof window !== "undefined"
      ? localStorage.getItem("guest") === "true"
      : false;

  const [userName, setUserName] = useState<string | null>(null);
  const info = partneringInfo[category];

  /* REQUIRE LOGIN */
  useEffect(() => {
    if (isGuest || !phone) {
      alert("Please login to continue.");
      router.push("/login");
    }
  }, [isGuest, phone, router]);

  /* LOAD USER NAME */
  useEffect(() => {
    if (!phone) return;

    const fetchUser = async () => {
      const snap = await getDoc(doc(db, "users", phone));
      if (snap.exists()) {
        setUserName((snap.data() as any).name || null);
      }
    };

    fetchUser();
  }, [phone]);

  /* SAVE PARTNER */
  const savePartner = async () => {
    if (!phone) return;

    try {
      const result = await createOrJoinGroup(category, option, phone);

      await addDoc(collection(db, "selections"), {
        phone,
        userName,
        category,
        option,
        createdAt: serverTimestamp(),
      });

      alert(
        `Partner saved!\nStatus: ${result.status}\nMembers: ${result.membersCount}/${getRequiredSize(
          option
        )}`
      );

      router.push("/categories");
    } catch {
      alert("Saving failed.");
    }
  };

  return (
    <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
      {/* HEADER */}
      <h1 className="text-3xl font-semibold text-[#FFD166] tracking-wide mb-4">
        Make Your Match
      </h1>

      <p className="text-gray-400 mb-8">
        You selected{" "}
        <span className="text-[#FFD166] font-medium">{option}</span> under{" "}
        <span className="text-[#FFD166] font-medium">
          {category.replace("-", " ")}
        </span>
      </p>

      {/* CATEGORY INFO */}
      {info && (
        <div className="
          mb-8 max-w-3xl
          border border-[#FFD166]/20
          p-6 rounded-2xl
          bg-gradient-to-br from-[#0e0e0e] to-black
        ">
          <h2 className="text-lg font-semibold text-[#FFD166] mb-2">
            {info.title}
          </h2>

          {info.topLine && (
            <p className="text-gray-400 mb-4">{info.topLine}</p>
          )}

          <ul className="space-y-4 text-sm">
            {info.sections.map((sec: any, i: number) => (
              <li key={i}>
                <span className="font-medium text-[#FFD166]">
                  {sec.title}
                </span>
                <div className="text-gray-400">{sec.text}</div>
                {sec.example && (
                  <div className="text-gray-500 mt-1">{sec.example}</div>
                )}
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-gray-500 mt-5 italic">
            SplitPartnering is a partnering service. We do not buy or sell products.
          </p>
        </div>
      )}

      {/* SAVE BUTTON */}
      <button
        onClick={savePartner}
        className="
          px-8 py-3 rounded-xl font-semibold
          bg-black text-[#E6C972]
          border border-[#E6C972]
          shadow-[0_0_18px_rgba(230,201,114,0.75)]
          hover:bg-[#F3DC8A]
          hover:text-black
          hover:shadow-[0_0_36px_rgba(230,201,114,1)]
          transition-all duration-200
        "
      >
        Make Partner
      </button>

      {/* BACK */}
      <button
        onClick={() => router.push("/categories")}
        className="block mt-8 text-[#FFD166] hover:underline text-sm tracking-wide"
      >
        ← Back to Categories
      </button>
    </div>
  );
}

/* WRAPPER */
export default function SavePage() {
  return (
    <Suspense fallback={<p className="text-gray-400 p-10">Loading...</p>}>
      <SaveContent />
    </Suspense>
  );
}
