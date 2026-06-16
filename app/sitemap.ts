import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://partnering.in";

  const routes = [
    "",
    "/about",
    "/categories",
    "/collaborators",
    "/contact",
    "/dashboard",
    "/faq",
    "/help",
    "/investors",
    "/login",
    "/privacy-policy",
    "/refund-policy",
    "/team",
    "/terms",
    "/trust-and-safety",
    "/verify-phone",
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1.0 : 0.8,
  }));
}