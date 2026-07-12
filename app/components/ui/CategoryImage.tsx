"use client";

import Image from "next/image";
import { useState } from "react";
import { getCategoryImage, getBestSubcategoryImage, FALLBACK_IMAGE } from "@/app/data/categoryImages";

interface CategoryImageProps {
  categorySlug: string;
  subcategorySlug?: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  fill?: boolean;
  sizes?: string;
  fallbackIcon?: string; // Emoji fallback if image fails
}

export default function CategoryImage({
  categorySlug,
  subcategorySlug,
  alt,
  className = "",
  width = 48,
  height = 48,
  priority = false,
  fill = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  fallbackIcon,
}: CategoryImageProps) {
  const [imgError, setImgError] = useState(false);

  // Get the best available image path
  const imagePath = subcategorySlug
    ? getBestSubcategoryImage(categorySlug, subcategorySlug)
    : getCategoryImage(categorySlug);

  // If image failed or is fallback, show icon fallback
  if (imgError || imagePath === FALLBACK_IMAGE) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 ${className}`}
        style={{ width: fill ? undefined : width, height: fill ? undefined : height }}
      >
        <span className="text-lg">{fallbackIcon || "📁"}</span>
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={imagePath}
        alt={alt}
        fill
        className={`object-cover ${className}`}
        sizes={sizes}
        priority={priority}
        onError={() => setImgError(true)}
        loading={priority ? undefined : "lazy"}
      />
    );
  }

  return (
    <Image
      src={imagePath}
      alt={alt}
      width={width}
      height={height}
      className={`object-cover ${className}`}
      priority={priority}
      onError={() => setImgError(true)}
      loading={priority ? undefined : "lazy"}
    />
  );
}