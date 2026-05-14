"use client";

import { useRouter } from "next/navigation";

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen pt-28 px-6 text-white">

      <h1 className="text-3xl font-bold text-[#16FF6E] mb-4">
        About SplitPartnering
      </h1>

      <p className="text-gray-300 max-w-2xl mb-8 leading-relaxed">
        SplitPartnering is a platform designed to help people <span className="text-[#16FF6E] font-semibold">
        partner with others</span> who want the same offers — so everyone pays less.  
        No public groups, no random forwarding, and no unnecessary sharing.  
        Everything happens privately through verified matching.
      </p>

      <h2 className="text-2xl text-[#16FF6E] font-semibold mt-6 mb-3">
        Why We Built This
      </h2>

      <ul className="list-disc ml-6 text-gray-300 max-w-2xl space-y-2 text-sm">
        <li>To help people save money through shared purchases.</li>
        <li>To avoid fake offers and spammy WhatsApp groups.</li>
        <li>To give users a safe, private, verified matching system.</li>
        <li>To make partnering easier and faster with automation.</li>
      </ul>

      <h2 className="text-2xl text-[#16FF6E] font-semibold mt-10 mb-3">
        How It Works
      </h2>

      <p className="text-gray-300 max-w-2xl text-sm leading-relaxed mb-4">
        • Select a category (Gym, Fashion, Movies, Books etc.)  
        <br />• Choose your exact option  
        <br />• Click <strong>Save Partner</strong> to join a matching group  
        <br />• Admin verifies and contacts all members privately  
      </p>

      <h2 className="text-2xl text-[#16FF6E] font-semibold mt-10 mb-3">
        Safety & Privacy
      </h2>

      <ul className="list-disc ml-6 text-gray-300 max-w-2xl space-y-2 text-sm">
        <li>Your number is never made public.</li>
        <li>No group links will be shared without your permission.</li>
        <li>Only admin monitors and handles matching.</li>
        <li>Your data is stored securely.</li>
      </ul>

      {/* BUTTONS */}
      <div className="flex flex-col gap-4 mt-12 max-w-sm">

        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 border border-[#16FF6E]/60 rounded-xl text-[#16FF6E] hover:bg-[#16FF6E] hover:text-black transition"
        >
          ← Back to Home
        </button>

        <button
          onClick={() => router.push("/help")}
          className="px-6 py-3 bg-[#16FF6E]/10 border border-[#16FF6E]/40 rounded-xl text-[#16FF6E] hover:bg-[#16FF6E] hover:text-black transition"
        >
          How Splitting Works
        </button>

        <button
          onClick={() => router.push("/ai")}
          className="px-6 py-3 bg-[#16FF6E] text-black rounded-xl font-semibold hover:bg-white transition"
        >
          Ask AI Anything 🤖
        </button>

        <button
          onClick={() => window.open("https://wa.me/917207392307", "_blank")}
          className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-500 transition"
        >
          Contact Admin on WhatsApp
        </button>
      </div>

    </div>
  );
}
