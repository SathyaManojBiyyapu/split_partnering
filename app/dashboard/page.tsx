"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  DocumentData,
} from "firebase/firestore";

type Group = {
  id: string;
  category: string;
  option: string;
  members: string[];
  membersCount: number;
  requiredSize: number;
  status: string;
  createdAt?: any;
};

export default function DashboardPage() {
  const rawPhone =
    typeof window !== "undefined" ? localStorage.getItem("phone") : null;

  const phone = rawPhone ? rawPhone.trim() : null;

  const [latestSelection, setLatestSelection] =
    useState<{ category: string; option: string } | null>(null);

  const [matches, setMatches] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  /* ------------------------------------------------
        FETCH LATEST SELECTION
  ------------------------------------------------ */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const loadLatest = async () => {
      try {
        const selRef = collection(db, "selections");
        const qSel = query(selRef, where("phone", "==", phone));
        const snap = await getDocs(qSel);

        if (!snap.empty) {
          const sorted = snap.docs.sort(
            (a, b) =>
              (b.data().createdAt?.seconds || 0) -
              (a.data().createdAt?.seconds || 0)
          );

          const last = sorted[0].data() as DocumentData;

          setLatestSelection({
            category: last.category,
            option: last.option,
          });
        }
      } catch (err) {
        console.error("Latest selection error:", err);
      }

      setLoading(false);
    };

    loadLatest();
  }, [phone]);

  /* ------------------------------------------------
        FETCH MATCHED GROUPS
  ------------------------------------------------ */
  useEffect(() => {
    if (!phone) return;

    const groupsRef = collection(db, "groups");
    const qGroups = query(groupsRef, where("members", "array-contains", phone));

    const unsub = onSnapshot(qGroups, (snapshot) => {
      const list: Group[] = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;

        list.push({
          id: docSnap.id,
          category: data.category,
          option: data.option,
          members: (data.members || []).map((p: string) => p.trim()),
          membersCount:
            data.membersCount ?? (data.members ? data.members.length : 0),
          requiredSize: data.requiredSize,
          status: data.status,
          createdAt: data.createdAt,
        });
      });

      list.sort(
        (a, b) =>
          (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

      setMatches(list);
    });

    return () => unsub();
  }, [phone]);

  /* ------------------------------------------------
        DELETE MATCH
  ------------------------------------------------ */
  const deleteMatch = async (groupId: string) => {
    if (!confirm("Remove this match?")) return;
    if (!phone) return;

    try {
      const gRef = doc(db, "groups", groupId);
      const snap = await getDoc(gRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const currentCount =
        data.membersCount ?? (data.members ? data.members.length : 0);
      const newCount = Math.max(0, currentCount - 1);

      await updateDoc(gRef, {
        members: arrayRemove(phone),
        membersCount: newCount,
      });

      if (newCount === 0) {
        await deleteDoc(gRef);
      }

      alert("Match removed successfully");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to remove match");
    }
  };

  /* ------------------------------------------------
        AUTH REQUIRED
  ------------------------------------------------ */
  if (!phone) {
    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto">
        <h1 className="font-heading text-3xl text-gold-primary">
          My Partners
        </h1>
        <p className="mt-4 text-text-muted">
          Please login with OTP to view your matches.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------
        LOADING
  ------------------------------------------------ */
  if (loading) {
    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto">
        <h1 className="font-heading text-3xl text-gold-primary">
          My Partners
        </h1>
        <p className="mt-4 text-text-muted">Loading...</p>
      </div>
    );
  }

  /* ------------------------------------------------
        UI
  ------------------------------------------------ */
  return (
    <div className="pt-32 px-6 max-w-5xl mx-auto">
      <h1 className="font-heading text-3xl text-gold-primary">
        My Partners
      </h1>

      {latestSelection && (
        <p className="text-text-muted mt-4">
          Latest selection:{" "}
          <span className="text-gold-primary font-semibold">
            {latestSelection.category.replace("-", " ")} →{" "}
            {latestSelection.option}
          </span>
        </p>
      )}

      {matches.length === 0 ? (
        <p className="text-text-muted mt-6">
          No partners saved yet.
        </p>
      ) : (
        <div className="mt-10 space-y-5">
          {matches.map((group) => (
            <div
              key={group.id}
              className="
                rounded-2xl p-5
                bg-black/40 border border-dark-card
                hover:border-gold-primary
                hover:shadow-[0_0_25px_rgba(212,175,55,0.35)]
                transition
              "
            >
              <p className="font-heading text-lg text-gold-primary capitalize">
                {group.category.replace("-", " ")} → {group.option}
              </p>

              <p className="mt-2 text-sm text-text-body">
                Status:{" "}
                <span
                  className={
                    group.status === "ready"
                      ? "text-green-400"
                      : group.status === "completed"
                      ? "text-blue-400"
                      : "text-yellow-400"
                  }
                >
                  {group.status}
                </span>
              </p>

              <p className="mt-1 text-sm text-text-muted">
                Progress: {group.membersCount}/{group.requiredSize}
              </p>

              <button
                onClick={() => deleteMatch(group.id)}
                className="
                  mt-4 px-4 py-2 text-xs font-medium
                  rounded-full
                  border border-red-500/40
                  text-red-400
                  hover:bg-red-600/20 hover:border-red-500
                  transition
                "
              >
                Remove Match
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
