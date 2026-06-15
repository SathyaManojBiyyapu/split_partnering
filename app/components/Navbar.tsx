"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { db } from "@/firebase/config";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

const links = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Explore" },
  { href: "/dashboard", label: "My Matches" },
  { href: "/collaborators", label: "Collaborators" },
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
    <header className="sticky top-0 z-30 border-b border-[#D4AF37]/10 bg-black/70 backdrop-blur-xl">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* LEFT LOGO */}
        <Link href="/" className="flex items-center gap-2 z-10">
          <Image
            src="/logo.png"
            alt="PartnerSync Logo"
            width={48}
            height={48}
            priority
            className="block"
          />

          <span className="font-heading text-lg sm:text-xl tracking-wide text-white">
            Partner<span className="text-[#D4AF37]">Sync</span>
          </span>
        </Link>

        {/* RIGHT LINKS */}
        <div className="hidden md:flex items-center gap-2 text-sm z-10">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full transition-all duration-200 text-xs
                  ${
                    isActive
                      ? "text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/5"
                      : "text-gray-400 hover:text-[#D4AF37] hover:border hover:border-[#D4AF37]/20"
                  }`}
              >
                {link.label}
              </Link>
            );
          })}

          {!loggedIn && !guest && (
            <Link
              href="/login"
              className="ml-2 rounded-full border border-[#D4AF37]/30 px-3 py-1.5 text-xs
                         font-medium text-[#D4AF37]
                         hover:bg-[#D4AF37]/5
                         transition"
            >
              Login
            </Link>
          )}

          {(loggedIn || guest) && (
            <div className="flex items-center gap-2 ml-2">
              <Link
                href="/profile"
                className="glass-strong rounded-full px-3 py-1.5 text-xs text-gray-300 hover:text-[#D4AF37] transition"
              >
                Profile
              </Link>
              <button
                onClick={logout}
                className="rounded-full border border-red-500/20 bg-red-500/5
                           px-3 py-1.5 text-xs font-medium text-red-400
                           hover:bg-red-500/10 hover:border-red-500/30 transition"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}