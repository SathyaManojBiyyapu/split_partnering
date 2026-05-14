"use client";

import "./globals.css";

import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import Footer from "./components/Footer";

import { AuthProvider, useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import { Inter, Playfair_Display } from "next/font/google";
import { Toaster } from "react-hot-toast";

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

function AuthGuard({ children }: any) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const protectedPages = [
    "/profile",
    "/my-details",
    "/dashboard",
    "/save",
  ];

  useEffect(() => {
    if (loading) return;

    const guest = localStorage.getItem("guest") === "true";

    if (
      pathname === "/" ||
      pathname === "/login" ||
      pathname.startsWith("/help") ||
      pathname.startsWith("/ai") ||
      pathname.startsWith("/categories") ||
      pathname.startsWith("/investors") ||
      pathname.startsWith("/team") ||
      pathname.startsWith("/contact")
    ) {
      return;
    }

    if (!protectedPages.some((p) => pathname.startsWith(p))) return;

    if (guest) {
      router.push("/login");
      return;
    }

    if (!user) {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  return children;
}

export default function RootLayout({ children }: any) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="bg-black text-white font-body">
        <AuthProvider>
          <Navbar />
          <Sidebar />

          <main className="pt-0 bg-black">
            <AuthGuard>{children}</AuthGuard>
          </main>

          <Footer />
        </AuthProvider>

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#000",
              color: "#FFD166",
              border: "1px solid #FFD166",
              boxShadow: "0 0 18px rgba(255,209,102,0.6)",
            },
          }}
        />
      </body>
    </html>
  );
}
