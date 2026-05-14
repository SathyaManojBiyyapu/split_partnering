"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Simple dummy AI response generator
const getAIResponse = (msg: string) => {
  if (!msg) return "Please type something.";
  if (msg.toLowerCase().includes("hello")) return "Hello! How can I help you?";
  if (msg.toLowerCase().includes("partner"))
    return "To save a partner, choose a category, select an option, and tap Save Partner.";
  if (msg.toLowerCase().includes("admin"))
    return "Admin will contact you on WhatsApp when your group is ready.";

  return "Got it! I will try my best to assist you.";
};

export default function AIChatPage() {
  const router = useRouter();

  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    const aiMsg = { sender: "ai", text: getAIResponse(input) };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
  };

  return (
    <div className="min-h-screen pt-28 px-6 text-white flex flex-col">

      <h1 className="text-3xl font-bold text-[#16FF6E] mb-6">
        AI Assistant 🤖
      </h1>

      <div className="flex-1 overflow-y-auto bg-black/30 border border-[#16FF6E]/30 rounded-xl p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center text-sm">
            Ask me anything about SplitPartnering!
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-xl max-w-xs ${
              msg.sender === "user"
                ? "ml-auto bg-[#16FF6E] text-black"
                : "mr-auto bg-black/60 border border-[#16FF6E]/30"
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input Section */}
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          placeholder="Ask something…"
          className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-[#16FF6E]/40 text-white focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />

        <button
          onClick={sendMessage}
          className="px-5 bg-[#16FF6E] text-black font-semibold rounded-xl hover:bg-white transition"
        >
          Send
        </button>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex flex-col gap-3 max-w-xs">

        <button
          onClick={() => router.push("/")}
          className="px-6 py-3 bg-[#16FF6E]/10 border border-[#16FF6E]/50 rounded-xl text-[#16FF6E] hover:bg-[#16FF6E] hover:text-black transition"
        >
          ← Back to Home
        </button>

        <button
          onClick={() => router.push("/help")}
          className="px-6 py-3 bg-[#16FF6E] text-black rounded-xl font-semibold hover:bg-white transition"
        >
          How Splitting Works
        </button>
      </div>

    </div>
  );
}
