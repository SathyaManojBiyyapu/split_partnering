"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/dashboard", label: "My Matches" },
  { href: "/investors", label: "Investors" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-30 border-b border-dark-card bg-black/90 backdrop-blur">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

        {/* LEFT LOGO (3x BIGGER, CLEAN) */}
        <Link href="/" className="flex items-center gap-3 z-10">
          <Image
            src="/logo.png"
            alt="PartnerSync Logo"
            width={80}
            height={80}
            priority
            className="block"
          />

          <span className="font-heading text-xl sm:text-2xl tracking-wide text-white">
            Partner<span className="text-gold-primary">Sync</span>
          </span>
        </Link>

        {/* RIGHT LINKS */}
        <div className="hidden md:flex items-center gap-3 text-sm font-body z-10">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-1.5 rounded-full transition-all duration-200
                  ${
                    isActive
                      ? "text-gold-primary border border-gold-primary shadow-[0_0_20px_rgba(212,175,55,0.9)]"
                      : "text-text-muted hover:text-gold-primary hover:border hover:border-gold-primary hover:shadow-[0_0_18px_rgba(212,175,55,0.7)]"
                  }`}
              >
                {link.label}
              </Link>
            );
          })}

          {!loggedIn && !guest && (
            <Link
              href="/login"
              className="ml-2 rounded-full border border-gold-primary px-3 py-1.5 text-xs
                         font-medium text-gold-primary
                         hover:shadow-[0_0_18px_rgba(212,175,55,0.8)]
                         transition"
            >
              Login / OTP
            </Link>
          )}

          {(loggedIn || guest) && (
            <button
              onClick={logout}
              className="ml-2 rounded-full border border-red-500/40 bg-red-600/10
                         px-3 py-1.5 text-xs font-medium text-red-400
                         hover:bg-red-600/20 hover:border-red-500 transition"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
