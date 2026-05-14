"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.reload();
  };

  return (
    <>
      {/* ===== LOGIN / REGISTER BUTTON (ADDED – NOTHING ELSE TOUCHED) ===== */}
      <button
        onClick={() => {
          if (loggedIn || guest) {
            window.location.href = "/profile";
          } else {
            window.location.href = "/login";
          }
        }}
        className="
          fixed top-2 right-16 sm:top-3 sm:right-20 z-50
          h-11 px-3 flex items-center justify-center
          rounded-lg
          bg-black text-gold-primary text-xs font-bold
          border border-gold-primary
          shadow-[0_0_18px_rgba(212,175,55,0.85)]
          hover:bg-gold-primary hover:text-black
          transition-all duration-200
        "
      >
        {loggedIn || guest ? "Profile" : "Login"}
      </button>

      {/* ===== SIDEBAR TOGGLE BUTTON ===== */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="
          fixed top-2 right-3 sm:top-3 sm:right-4 z-50
          h-11 w-11 flex items-center justify-center
          rounded-lg
          bg-black text-gold-primary text-xl font-bold
          border border-gold-primary
          shadow-[0_0_22px_rgba(212,175,55,0.95)]
          hover:bg-gold-primary hover:text-black
          hover:shadow-[0_0_35px_rgba(212,175,55,1)]
          transition-all duration-200
        "
      >
        ☰
      </button>

      {/* OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        />
      )}

      {/* RIGHT-SIDE PANEL */}
      <div
        className={`fixed top-0 right-0 h-full z-50 p-6
          w-[85vw] sm:w-72
          bg-dark-section border-l border-dark-card
          transform transition-all duration-300
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-heading text-lg sm:text-xl text-gold-primary">
            Menu
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-text-muted hover:text-gold-primary text-xl transition"
          >
            ✕
          </button>
        </div>

        {/* MENU LINKS */}
        <div className="flex flex-col gap-5 text-sm font-body">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            🏠 Home
          </Link>

          <Link
            href="/categories"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            🛍 Categories
          </Link>

          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            🤝 My Matches
          </Link>

          <Link
            href="/investors"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            💼 Investors
          </Link>

          {(loggedIn || guest) && (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="text-text-body hover:text-gold-primary transition"
            >
              👤 My Profile
            </Link>
          )}

          <Link
            href="/help"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            ❓ How it works
          </Link>

          <Link
            href="/ai"
            onClick={() => setOpen(false)}
            className="text-text-body hover:text-gold-primary transition"
          >
            🤖 AI Chat
          </Link>

          {(loggedIn || guest) && (
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="text-red-400 hover:text-red-300 text-left transition"
            >
              🚪 Logout
            </button>
          )}

          {/* ADMIN */}
          <button
            onClick={() => (window.location.href = "/admin")}
            className="text-[10px] text-text-muted opacity-20 text-left
                       hover:opacity-100 transition mt-8"
          >
            admin panel
          </button>
        </div>
      </div>
    </>
  );
}
