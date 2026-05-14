"use client";  // MUST be the first line!

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/dashboard", label: "My Matches" },
  { href: "/admin", label: "Admin" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-[#16FF6E]/30 bg-black/70 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#16FF6E] shadow-[0_0_15px_#16FF6E]" />
          <span className="text-lg font-semibold tracking-wide">
            split<span className="text-[#16FF6E]">partnering</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1 rounded-full transition ${
                pathname === link.href
                  ? "bg-[#16FF6E] text-black shadow-[0_0_15px_#16FF6E]"
                  : "text-gray-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}

          <button className="ml-3 rounded-full border border-[#16FF6E]/40 bg-black/60 px-3 py-1 text-xs font-medium text-[#16FF6E] shadow-[0_0_10px_rgba(22,255,110,0.4)] hover:border-[#16FF6E]">
            Login / OTP
          </button>
        </div>
      </nav>
    </header>
  );
}

































