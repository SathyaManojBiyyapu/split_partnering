"use client";

export default function TrustStrip() {
  const items = [
    { icon: "✓", text: "OTP Verified Users", color: "text-green-400" },
    { icon: "🔒", text: "Privacy Protected", color: "text-blue-400" },
    { icon: "💳", text: "Secure Payments", color: "text-purple-400" },
    { icon: "⭐", text: "Verified Partners", color: "text-[#FFD166]" },
    { icon: "📍", text: "Location Based Matching", color: "text-orange-400" },
  ];

  return (
    <div className="bg-gradient-to-r from-[#0a0a0a] via-[#111] to-[#0a0a0a] border-b border-[#D4AF37]/5 py-2 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-center sm:justify-between gap-3 sm:gap-0 flex-wrap">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] sm:text-[11px]">
              <span className={`${item.color} font-bold`}>{item.icon}</span>
              <span className="text-gray-400 whitespace-nowrap">{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}