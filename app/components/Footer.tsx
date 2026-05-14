"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-black text-white border-t border-dark-card mt-32">
      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* ===== TOP GRID ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

          {/* BRAND */}
          <div>
            <h3 className="font-heading text-lg text-gold-primary mb-3">
              PartnerSync
            </h3>
            <p className="text-text-muted text-sm leading-relaxed max-w-sm">
              PartnerSync is building a trust-based collaboration platform
              that enables people to save more, access better opportunities,
              and create shared value together.
            </p>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h4 className="font-heading text-sm text-gold-primary mb-4">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm text-text-body">
              <li>
                <Link href="/" className="hover:text-gold-primary transition">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/categories" className="hover:text-gold-primary transition">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/investors" className="hover:text-gold-primary transition">
                  Investors
                </Link>
              </li>
              <li>
                <Link href="/team" className="hover:text-gold-primary transition">
                  Team
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-gold-primary transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h4 className="font-heading text-sm text-gold-primary mb-4">
              Contact Us
            </h4>
            <ul className="space-y-2 text-sm text-text-body">
              <li>
                Email:
                <span className="text-text-muted ml-1">
                  syncpartnerduo@gmail.com
                </span>
              </li>
              <li>
                Phone:
                <span className="text-text-muted ml-1">
                  +91 99496 58599
                </span>
              </li>
              <li>
                Location:
                <span className="text-text-muted ml-1">
                  Vijayawada, India
                </span>
              </li>
            </ul>
          </div>

        </div>

        {/* ===== BOTTOM BAR ===== */}
        <div className="border-t border-dark-card mt-12 pt-6 text-center text-xs text-text-muted space-y-3">

          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-gold-primary transition">
              Terms & Conditions
            </Link>
            <Link href="/refund-policy" className="hover:text-gold-primary transition">
              Refund & Cancellation Policy
            </Link>
            <Link href="/privacy-policy" className="hover:text-gold-primary transition">
              Privacy Policy
            </Link>
          </div>

          <p>
            © {new Date().getFullYear()} PartnerSync. All Rights Reserved.
          </p>

        </div>

      </div>
    </footer>
  );
}
