"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isStickyCtaPage } from "@/app/lib/mobileCta";

export default function SupportButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Pages with their own sticky bottom bar: keep the floating button above
  // the bar on mobile so it never overlaps the page-level CTA.
  const stickyPage = isStickyCtaPage(pathname || "");

  // Mark the body so the global floating "Find Partners" pill (rendered in
  // the root layout) can hide itself on mobile on pages that already have
  // their own sticky bottom bar — otherwise the two would overlap.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (stickyPage) {
      document.body.setAttribute("data-sticky-cta", "true");
    } else {
      document.body.removeAttribute("data-sticky-cta");
    }
    return () => document.body.removeAttribute("data-sticky-cta");
  }, [stickyPage]);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black shadow-[0_0_20px_rgba(230,201,114,0.5)] hover:shadow-[0_0_30px_rgba(230,201,114,0.7)] transition-all duration-300 flex items-center justify-center text-lg font-bold hover:scale-110 ${
          stickyPage ? "bottom-[88px] sm:bottom-6" : "bottom-6"
        }`}
      >
        ?
      </button>

      {/* Popup */}
      {open && (
        <div
          className={`fixed right-6 z-50 w-64 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-2xl p-4 shadow-2xl ${
            stickyPage ? "bottom-[144px] sm:bottom-20" : "bottom-20"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[#FFD166]">Need Help?</p>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-xs">✕</button>
          </div>
          <div className="space-y-2">
            <a
              href="mailto:support@partnersync.in"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/50 border border-gray-800 hover:border-[#FFD166]/30 transition text-xs text-gray-300 hover:text-white"
            >
              <span className="text-lg">📧</span>
              <div>
                <p className="font-medium">Email Support</p>
                <p className="text-[9px] text-gray-500">support@partnersync.in</p>
              </div>
            </a>
            <a
              href="https://wa.me/919949658599"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/50 border border-gray-800 hover:border-[#FFD166]/30 transition text-xs text-gray-300 hover:text-white"
            >
              <span className="text-lg">💬</span>
              <div>
                <p className="font-medium">WhatsApp</p>
                <p className="text-[9px] text-gray-500">+91 99496 58599</p>
              </div>
            </a>
            <a
              href="/faq"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/50 border border-gray-800 hover:border-[#FFD166]/30 transition text-xs text-gray-300 hover:text-white"
            >
              <span className="text-lg">❓</span>
              <div>
                <p className="font-medium">FAQ</p>
                <p className="text-[9px] text-gray-500">Frequently Asked Questions</p>
              </div>
            </a>
          </div>
        </div>
      )}
    </>
  );
}