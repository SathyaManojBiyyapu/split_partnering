"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/offers", label: "Offers" },
  { href: "/dashboard", label: "My Partners" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/5 navbar-premium">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3">
        {/* LEFT LOGO */}
        <Link href="/" className="flex items-center gap-2 z-10 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="PartnerSync Logo"
            width={36}
            height={36}
            priority
            className="block"
            style={{ width: "auto", height: "auto" }}
          />
          <span className="font-heading text-base sm:text-lg tracking-wide text-white">
            Partner<span className="text-[#D4AF37]">Sync</span>
          </span>
        </Link>

        {/* CENTER LINKS - Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full transition-all duration-200 text-xs font-medium ${
                  active
                    ? "text-[#D4AF37] bg-[#D4AF37]/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* RIGHT - Desktop */}
        <div className="hidden md:flex items-center gap-2 z-10 flex-shrink-0">
          {/* Create Group */}
          <Link
            href="/create-group"
            className="rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white transition-all duration-200"
          >
            Create Group
          </Link>
          {/* Notifications */}
          <Link
            href="/notifications"
            className="relative rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition"
            aria-label="Notifications"
          >
            🔔
          </Link>
          {/* Primary CTA */}
          <Link
            href="/find-partners"
            className="rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] px-4 py-1.5 text-xs font-bold text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all duration-200"
          >
            Find Partners
          </Link>

          {/* Auth */}
          {!loggedIn && !guest && (
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/5 hover:text-white transition"
            >
              Login
            </Link>
          )}
          {(loggedIn || guest) && (
            <div className="flex items-center gap-2">
              <Link
                href="/profile"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/10 hover:text-white transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {/* MOBILE TOGGLE */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="md:hidden relative z-50 h-10 w-10 flex items-center justify-center rounded-lg border border-[#D4AF37]/30 text-[#D4AF37] text-xl"
        >
          ☰
        </button>
      </nav>

      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* MOBILE DRAWER */}
      <div
        className={`fixed top-0 right-0 h-full z-50 p-6 w-[80vw] max-w-sm bg-black border-l border-white/10 transform transition-all duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-lg text-[#D4AF37]">Menu</h2>
          <button
            onClick={() => setMobileOpen(false)}
            className="text-gray-400 hover:text-white text-xl transition"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {/* Nav Links */}
        <div className="flex flex-col gap-2">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "text-[#D4AF37] bg-[#D4AF37]/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {link.label}
                {active && <span className="ml-2 text-[#D4AF37]">●</span>}
              </Link>
            );
          })}

          <div className="h-px bg-white/5 my-3" />

          {/* Mobile CTAs */}
          <Link
            href="/find-partners"
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black"
          >
            Find Partners
          </Link>
          <Link
            href="/create-group"
            onClick={() => setMobileOpen(false)}
            className="block w-full text-center py-3 rounded-xl font-semibold text-sm border border-white/20 text-white hover:bg-white/5 transition"
          >
            Create a Group
          </Link>

          <div className="h-px bg-white/5 my-3" />

          {/* Auth Links */}
          {!loggedIn && !guest && (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
            >
              Login
            </Link>
          )}
          {(loggedIn || guest) && (
            <>
              <Link
                href="/notifications"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                🔔 Notifications
              </Link>
              <Link
                href="/profile"
                onClick={() => setMobileOpen(false)}
                className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
              >
                Profile
              </Link>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 text-left transition"
              >
                Logout
              </button>
            </>
          )}

          <div className="h-px bg-white/5 my-3" />

          {/* Safety */}
          <Link
            href="/trust-safety"
            onClick={() => setMobileOpen(false)}
            className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            🛡️ Trust & Safety
          </Link>

          {/* Help */}
          <Link
            href="/help"
            onClick={() => setMobileOpen(false)}
            className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition"
          >
            Help & Support
          </Link>
        </div>
      </div>
    </header>
  );
}