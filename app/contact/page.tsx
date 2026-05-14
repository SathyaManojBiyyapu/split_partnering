"use client";

import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-dark-section text-white px-6 py-24">
      <div className="max-w-4xl mx-auto">

        {/* ===== TITLE ===== */}
        <div className="text-center mb-20">
          <h1 className="font-heading text-3xl sm:text-4xl mb-4">
            Contact <span className="text-gold-primary">PartnerSync</span>
          </h1>
          <p className="text-text-muted text-sm max-w-xl mx-auto">
            We’re open to investor conversations, strategic partnerships,
            and early collaborations. Reach out — we’ll respond promptly.
          </p>
        </div>

        {/* ===== CONTACT CARD ===== */}
        <div
          className="rounded-3xl bg-black/40 border border-dark-card
                     p-10 sm:p-14 text-center
                     shadow-[0_0_40px_rgba(212,175,55,0.15)]"
        >
          <h2 className="font-heading text-xl mb-6">
            Get in Touch
          </h2>

          <p className="text-text-body text-sm leading-relaxed mb-10">
            PartnerSync is being built with a long-term vision to enable
            trust-based collaboration and shared savings. If you’re an
            investor, partner, or early supporter, we’d love to connect.
          </p>

          {/* CONTACT DETAILS */}
          <div className="space-y-4 text-sm text-text-body mb-12">
            <p>
              📧 Email:
              <span className="text-gold-primary ml-2">
                syncpartnerduo@gmail.com
              </span>
            </p>
            <p>
              📞 Phone:
              <span className="text-gold-primary ml-2">
                +91 99496 58599
              </span>
            </p>
            <p>
              📍 Address:
              <span className="text-gold-primary ml-2">
                11-2-10, Podurangapet, Tenali, Guntur, Andhra Pradesh, India
              </span>
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="mailto:syncpartnerduo@gmail.com"
              className="px-8 py-3 rounded-full bg-gold-primary text-black
                         font-medium hover:bg-gold-soft transition"
            >
              Email Us
            </a>

            <Link
              href="/team"
              className="px-8 py-3 rounded-full border border-gold-primary
                         text-gold-primary hover:bg-gold-primary
                         hover:text-black transition"
            >
              Meet the Team
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
