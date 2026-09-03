"use client";

import "./globals.css";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SupportButton from "./components/SupportButton";
import ErrorBoundary from "./components/ErrorBoundary";
import GoldDotsBackground from "./components/GoldDotsBackground";
import { isStickyCtaPage } from "@/app/lib/mobileCta";

import {
  AuthProvider,
  useAuth,
} from "./context/AuthContext";

import { useEffect, ReactNode } from "react";

import Link from "next/link";
import {
  useRouter,
  usePathname,
} from "next/navigation";

import {
  Inter,
  Playfair_Display,
} from "next/font/google";

import { Toaster } from "react-hot-toast";
import { cn } from "@/lib/utils";

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

  const protectedPages = [
    "/profile",
    "/my-details",
    "/dashboard",
    "/save",
    "/find-partners",
    "/create-group",
    "/notifications",
  ];

  // Children are rendered unconditionally (server + first client paint) so
  // the page content — including the LCP element — is present in the initial
  // HTML and paints immediately. Protected-page redirects happen client-side
  // below, after Firebase auth state resolves; they never block first paint.
  useEffect(() => {
    if (loading) return;

    const guest = localStorage.getItem("guest") === "true";

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

    const isProtected = protectedPages.some(
      (page) => pathname.startsWith(page)
    );

    if (!isProtected) return;

    if (guest) {
      router.push("/login");
      return;
    }

    if (!user) {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

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
      className={cn(
        inter.variable,
        playfair.variable,
        "font-sans"
      )}
    >
      <head>
        <title>PartnerSync — Split Costs. Save Money Together.</title>
        <meta name="description" content="PartnerSync helps people find compatible partners to split the cost of memberships, tickets, travel, subscriptions and more." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" />
        <link rel="canonical" href="https://partnering.in" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="PartnerSync" />
        <meta property="og:title" content="PartnerSync — Split Costs Together" />
        <meta property="og:description" content="PartnerSync helps people find compatible partners to split the cost of memberships, tickets, travel, subscriptions and more." />
        <meta property="og:url" content="https://partnering.in" />
        <meta property="og:image" content="https://partnering.in/logo.png" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="PartnerSync — Split Costs Together" />
        <meta name="twitter:description" content="Find trusted people nearby to split memberships, tickets, travel, subscriptions and more." />
        <meta name="twitter:image" content="https://partnering.in/logo.png" />
        <meta name="author" content="PartnerSync Digital Services Private Limited" />
        <meta name="robots" content="index, follow" />
      </head>
      <body
        suppressHydrationWarning
        className="text-white font-body"
      >
        <GoldDotsBackground />
        <AuthProvider>
          {/* NAVBAR */}
          <Navbar />

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
                description:
                  "India's trusted collaboration platform. Connect with verified partners and approved collaborators for cost-sharing and resource pooling.",
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
                  target:
                    "https://partnering.in/categories?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              }),
            }}
          />

          {/* MAIN CONTENT */}
          <main className="relative z-[1] min-h-screen">
            <ErrorBoundary>
              <AuthGuard>{children}</AuthGuard>
            </ErrorBoundary>
          </main>

          {/* FLOATING SUPPORT BUTTON */}
          <SupportButton />

          {/* FLOATING GLOBAL CTA - Find Partners */}
          <Link
            href="/categories"
            className="floating-cta"
          >
            Find Partners
          </Link>

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
                border: "1px solid #FFD166",
                boxShadow: "none",
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}