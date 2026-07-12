"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Explore" },
  { href: "/dashboard", label: "My Matches" },
  { href: "/collaborators", label: "Collaborators" },
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
    <header className="sticky top-0 z-30 border-b border-white/5 bg-black/80 backdrop-blur-xl">
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
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

        {/* CENTER LINKS - perfectly centered */}
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1">
          {links.map((link) => {
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-full transition-all duration-200 text-xs font-medium
                  ${
                    isActive
                      ? "text-[#D4AF37] bg-[#D4AF37]/10"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* RIGHT - Auth actions */}
        <div className="flex items-center gap-2 z-10 flex-shrink-0">
          {!loggedIn && !guest && (
            <Link
              href="/login"
              className="rounded-full border border-[#D4AF37]/30 px-3 py-1.5 text-xs
                         font-medium text-[#D4AF37]
                         hover:bg-[#D4AF37]/10
                         transition"
            >
              Login
            </Link>
          )}

          {(loggedIn || guest) && (
            <div className="flex items-center gap-2">
              <button
                onClick={logout}
                className="rounded-full border border-white/10 bg-white/5
                           px-3 py-1.5 text-xs font-medium text-gray-400
                           hover:bg-white/10 hover:text-white transition"
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