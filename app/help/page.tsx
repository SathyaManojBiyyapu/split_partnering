"use client";

import { useRouter } from "next/navigation";

export default function HelpPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen pt-28 px-6 text-white">

      <h1 className="text-3xl font-bold text-[#16FF6E] mb-4">
        How SplitPartnering Works
      </h1>

      <p className="text-gray-300 mb-8 max-w-2xl">
        SplitPartnering helps you team up with people who want the same deal —
        so both of you save money. No public groups, no spam, no hassle.
      </p>

      {/* STEPS */}
      <div className="space-y-6 max-w-2xl">

        <div className="p-4 rounded-xl bg-black/40 border border-[#16FF6E]/30">
          <p className="text-[#16FF6E] font-semibold mb-1">1 · Select a Category</p>
          <p className="text-gray-300 text-sm">
            Choose what you want to partner on — fashion, gym, travel, books and more.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-[#16FF6E]/30">
          <p className="text-[#16FF6E] font-semibold mb-1">2 · Make Your First Match</p>
          <p className="text-gray-300 text-sm">
            Open any option and click <strong>Save Partner</strong> to join a matching group.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-[#16FF6E]/30">
          <p className="text-[#16FF6E] font-semibold mb-1">3 · Auto Matching</p>
          <p className="text-gray-300 text-sm">
            You are placed into a private partner group. Once required partners join, the group becomes ready.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-[#16FF6E]/30">
          <p className="text-[#16FF6E] font-semibold mb-1">4 · Admin Contacts You</p>
          <p className="text-gray-300 text-sm">
            Admin will contact you personally on WhatsApp when the group is ready. 
            No random group links are shared for your safety.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-black/40 border border-[#16FF6E]/30">
          <p className="text-[#16FF6E] font-semibold mb-1">5 · Complete the Deal</p>
          <p className="text-gray-300 text-sm">
            Follow instructions sent by admin. Complete the purchase or activity with your matched partner.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <h2 className="text-2xl font-bold mt-12 mb-4 text-[#16FF6E]">Frequently Asked Questions</h2>

      <div className="space-y-4 max-w-2xl text-sm">
        <div>
          <p className="text-[#16FF6E] font-semibold">Is my phone number visible?</p>
          <p className="text-gray-300">Only admin sees your number. No public visibility.</p>
        </div>

        <div>
          <p className="text-[#16FF6E] font-semibold">How long does matching take?</p>
          <p className="text-gray-300">Depends on how soon others save the same option.</p>
        </div>

        <div>
          <p className="text-[#16FF6E] font-semibold">Is this safe?</p>
          <p className="text-gray-300">
            Yes. Admin verifies all matches and personally coordinates. 
            No open groups or third-party sharing.
          </p>
        </div>

        <div>
          <p className="text-[#16FF6E] font-semibold">Can I cancel?</p>
          <p className="text-gray-300">Yes, just message admin on WhatsApp.</p>
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex flex-col gap-4 mt-10">
        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-[#16FF6E]/10 border border-[#16FF6E]/50 rounded-xl text-[#16FF6E] hover:bg-[#16FF6E] hover:text-black transition"
        >
          ← Back to Home
        </button>

        <button
          onClick={() => (window.location.href = '/ai')}
          className="px-6 py-3 bg-[#16FF6E] text-black rounded-xl font-semibold hover:bg-white transition"
        >
          Ask AI for Help 🤖
        </button>

        <button
          onClick={() => window.open('https://wa.me/917207392307', '_blank')}
          className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-500 transition"
        >
          Contact Admin on WhatsApp
        </button>
      </div>
    </div>
  );
}

