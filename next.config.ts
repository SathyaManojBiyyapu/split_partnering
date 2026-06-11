import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.razorpay.com https://*.firebaseio.com https://apis.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://www.googleapis.com",
              "script-src-elem 'self' 'unsafe-inline' https://*.razorpay.com https://apis.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://www.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
              "img-src 'self' data: blob: https://*.firebasestorage.app https://ui-avatars.com https://*.googleapis.com https://*.gstatic.com https://www.google.com https://*.razorpay.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "frame-src https://*.razorpay.com https://*.firebaseapp.com https://accounts.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net",
              "connect-src 'self' https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://*.googleapis.com https://*.razorpay.com https://api.stripe.com wss://*.firebaseio.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://firebaseinstallations.googleapis.com",
              "manifest-src 'self'",
              "media-src 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
