"use client";

import { useEffect, useState } from "react";

// ADJUST PATH IF YOUR firebase/config IS INSIDE app folder:
// import { db } from "@/app/firebase/config";
import { db } from "@/firebase/config";

import { doc, getDoc } from "firebase/firestore";

export default function TestDB() {
  const [result, setResult] = useState<string>("running...");

  useEffect(() => {
    (async () => {
      try {
        console.log("db value:", db);
        console.log("doc typeof:", typeof doc);
        const testRef = doc(db, "___test_collection", "ping");
        console.log("testRef created:", !!testRef);
        // Try a light read (won't error if missing doc)
        const snap = await getDoc(testRef);
        console.log("got snap:", snap.exists());
        setResult(`OK runtime: db=${!!db}, docType=${typeof doc}, snapExists=${snap.exists()}`);
      } catch (err) {
        console.error("TESTDB ERROR:", err);
        setResult("ERROR: " + (err as any).message || String(err));
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2>TEST DB PAGE</h2>
      <pre>{result}</pre>
      <p>Check browser console for full logs.</p>
    </div>
  );
}
