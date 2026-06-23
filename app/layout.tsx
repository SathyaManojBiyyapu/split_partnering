"use client";

import "./globals.css";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";
import SupportButton from "./components/SupportButton";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import {
  useEffect,
  useState,
  ReactNode,
} from "react";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import {
  Inter,
  Playfair_Display,
} from "next/font/google";

import { Toaster } from "react-hot-toast";

/* ---------------- FONTS ---------------- */

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

/* ---------------- AUTH GUARD ---------------- */

function AuthGuard({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] =
    useState(false);

  /* -------- CLIENT MOUNT -------- */

  useEffect(() => {
    setMounted(true);
  }, []);

  const protectedPages = [
    "/profile",
    "/my-details",
    "/dashboard",
    "/save",
  ];

  useEffect(() => {
    if (!mounted || loading) return;

    const guest =
      localStorage.getItem("guest") === "true";

    /* -------- PUBLIC PAGES -------- */

    const publicPage =
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/ai") ||
      pathname.startsWith("/categories") ||
      pathname.startsWith("/investors") ||
      pathname.startsWith("/team") ||
      pathname.startsWith("/contact");

    if (publicPage) return;

    /* -------- CHECK PROTECTED -------- */

    const isProtected = protectedPages.some(
      (page) => pathname.startsWith(page)
    );

    if (!isProtected) return;

    /* -------- GUEST CHECK -------- */

    if (guest) {
      router.push("/login");
      return;
    }

    /* -------- USER CHECK -------- */

    if (!user) {
      router.push("/login");
    }
  }, [
    mounted,
    user,
    loading,
    pathname,
    router,
  ]);

  /* -------- PREVENT HYDRATION MISMATCH -------- */

  if (!mounted) return null;

  return <>{children}</>;
}

/* ---------------- ROOT LAYOUT ---------------- */

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-black text-white font-body"
      >
        <AuthProvider>
          {/* NAVBAR */}
          <Navbar />

          {/* SIDEBAR */}
          <Sidebar />

          {/* ORGANIZATION SCHEMA (JSON-LD) */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "PartnerSync",
                url: "https://partnering.in",
                logo: "https://partnering.in/logo.png",
                description: "India's trusted collaboration platform. Connect with verified partners and approved collaborators for cost-sharing and resource pooling.",
                email: "support@partnersync.in",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Vijayawada",
                  addressRegion: "Andhra Pradesh",
                  addressCountry: "IN",
                },
                sameAs: [],
                foundingDate: "2024",
              }),
            }}
          />
          {/* WEBSITE SCHEMA */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "PartnerSync",
                url: "https://partnering.in",
                potentialAction: {
                  "@type": "SearchAction",
                  target: "https://partnering.in/categories?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              }),
            }}
          />

          {/* MAIN CONTENT */}
          <main className="pt-0 bg-black min-h-screen">
            <AuthGuard>{children}</AuthGuard>
          </main>

          {/* FLOATING SUPPORT BUTTON */}
          <SupportButton />

          {/* FOOTER */}
          <Footer />

          {/* TOASTER */}
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#000",
                color: "#FFD166",
                border:
                  "1px solid #FFD166",
                boxShadow:
                  "0 0 18px rgba(255,209,102,0.6)",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}