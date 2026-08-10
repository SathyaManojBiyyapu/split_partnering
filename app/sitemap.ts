import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://partnering.in";

  // Only public/indexable pages — no protected pages (dashboard, profile, etc.)
  const routes = [
    "",
    "/about",
    "/categories",
    "/collaborators",
    "/contact",
    "/find-partners",
    "/faq",
    "/help",
    "/investors",
    "/login",
    "/offers",
    "/privacy-policy",
    "/refund-policy",
    "/team",
    "/terms",
    "/trust-and-safety",
    "/trust-safety",
    "/verify-phone",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  }));
}