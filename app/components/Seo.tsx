"use client";

import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: string;
};

const SITE_NAME = "PartnerSync";
const BASE_URL = "https://partnering.in";

/**
 * Client-side SEO component.
 * Sets page title, meta description, Open Graph, Twitter, and canonical URL.
 * Works in "use client" pages where `export const metadata` is unavailable.
 */
export default function Seo({
  title,
  description,
  canonicalPath = "/",
  ogType = "website",
}: SeoProps) {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
    const canonical = `${BASE_URL}${canonicalPath}`;

    document.title = fullTitle;

    // Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement("meta");
      metaDesc.setAttribute("name", "description");
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute("content", description);

    // Canonical
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonical);

    // Open Graph
    const ogTags: Record<string, string> = {
      "og:title": fullTitle,
      "og:description": description,
      "og:type": ogType,
      "og:url": canonical,
      "og:site_name": SITE_NAME,
      "og:image": `${BASE_URL}/logo.png`,
    };
    Object.entries(ogTags).forEach(([prop, content]) => {
      let tag = document.querySelector(`meta[property="${prop}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("property", prop);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    });

    // Twitter
    const twitterTags: Record<string, string> = {
      "twitter:card": "summary",
      "twitter:title": fullTitle,
      "twitter:description": description,
      "twitter:image": `${BASE_URL}/logo.png`,
    };
    Object.entries(twitterTags).forEach(([name, content]) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    });
  }, [title, description, canonicalPath, ogType]);

  return null;
}