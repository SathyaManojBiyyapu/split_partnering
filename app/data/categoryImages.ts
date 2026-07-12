// Centralized image mapping for all categories and subcategories
// Single source of truth - add new categories/subcategories here only
// Images are stored in public/images/categories/ and public/images/subcategories/

export type ImageMap = {
  [categorySlug: string]: {
    image: string; // Category-level image path
    subcategories?: {
      [subcategorySlug: string]: string; // Subcategory-level image path  
    };
  };
};

// Category images mapping
// Images stored at public/ root level for reliable serving
// Subcategory images stored at public/images/subcategories/{categorySlug}/{name}.webp
export const categoryImages: ImageMap = {
  gym: {
    image: "/gym.webp",
    subcategories: {
      split: "/images/subcategories/gym/gym-membership-split.webp",
      supplements: "/images/subcategories/gym/supplements-group-buy.webp",
      trainer: "/images/subcategories/gym/personal-trainer-split.webp",
      pass: "/images/subcategories/gym/day-pass-sharing.webp",
      equipment: "/images/subcategories/gym/fitness-equipment-group-buy.webp",
    },
  },
  fashion: {
    image: "/fashion.webp",
    subcategories: {
      "group-shopping": "/images/subcategories/fashion/group-shopping.webp",
      sneakers: "/images/subcategories/fashion/sneakers.webp",
    },
  },
  movies: {
    image: "/movies.webp",
    subcategories: {
      "save-ticket": "/images/subcategories/movies/save-ticket.webp",
      "bulk-ticket": "/images/subcategories/movies/bulk-ticket.webp",
    },
  },
  "local-travel": {
    image: "/travel.webp",
    subcategories: {
      "trip-cost": "/images/subcategories/travel/trip-cost-sharing.webp",
      cab: "/images/subcategories/travel/carpool.webp",
      hotel: "/images/subcategories/travel/hotel-sharing.webp",
      "travel-group": "/images/subcategories/travel/travel-groups.webp",
      "travel-partner": "/images/subcategories/travel/travel-partner.webp",
      backpacking: "/images/subcategories/travel/backpacking-groups.webp",
    },
  },
  lenskart: {
    image: "/lenskart.png",
    subcategories: {
      eyeglasses: "/images/subcategories/lenskart/eyeglasses-split.webp",
    },
  },
  events: {
    image: "/events.webp",
    subcategories: {
      passes: "/images/subcategories/events/event-passes.webp",
    },
  },
  coupons: {
    image: "/coupons.webp",
    subcategories: {
      discounts: "/images/subcategories/coupons/discount-coupons.webp",
    },
  },
  villas: {
    image: "/villas.webp",
    subcategories: {
      weekend: "/images/subcategories/villas/weekend-stay.webp",
    },
  },
  books: {
    image: "/books.webp",
    subcategories: {
      "book-exchange": "/images/subcategories/books/book-exchange.webp",
      "second-hand": "/images/subcategories/books/second-hand-books.webp",
      competitive: "/images/subcategories/books/competitive-exam-books.webp",
      engineering: "/images/subcategories/books/engineering-books.webp",
      academic: "/images/subcategories/books/academic-books.webp",
      novel: "/images/subcategories/books/novel-community.webp",
      "group-purchase": "/images/subcategories/books/group-book-purchases.webp",
    },
  },
};

// Fallback image when nothing is found
export const FALLBACK_IMAGE = "/partner-placeholder.svg";

/**
 * Get the best available image for a category
 * Priority: Category image > Fallback
 */
export function getCategoryImage(categorySlug: string): string {
  const entry = categoryImages[categorySlug];
  if (entry?.image) return entry.image;
  return FALLBACK_IMAGE;
}

/**
 * Get subcategory-specific image with fallback to category image
 */
export function getSubcategoryImage(categorySlug: string, subcategorySlug: string): string {
  const catEntry = categoryImages[categorySlug];
  // Try subcategory image first
  if (catEntry?.subcategories?.[subcategorySlug]) {
    return catEntry.subcategories[subcategorySlug];
  }
  // Fallback to category image
  if (catEntry?.image) return catEntry.image;
  return FALLBACK_IMAGE;
}

/**
 * Try multiple subcategory slugs for flexible matching
 * Useful when the stored option doesn't match the exact slug
 */
export function getBestSubcategoryImage(categorySlug: string, optionSlugOrName: string): string {
  // Try direct slug match first
  let result = getSubcategoryImage(categorySlug, optionSlugOrName);
  if (result !== FALLBACK_IMAGE) return result;

  // Try normalized version (lowercase, replace spaces with hyphens)
  const normalized = optionSlugOrName.toLowerCase().replace(/\s+/g, "-");
  result = getSubcategoryImage(categorySlug, normalized);
  if (result !== FALLBACK_IMAGE) return result;

  // Fallback to category image
  return getCategoryImage(categorySlug);
}

/**
 * Get image for a business/gym from its Firestore data
 * Priority: Business image > Subcategory image > Category image > Fallback
 */
export function getBusinessImage(business: any, categorySlug?: string): string {
  if (business?.image) return business.image;
  if (business?.logoUrl) return business.logoUrl;
  if (categorySlug) return getCategoryImage(categorySlug);
  return FALLBACK_IMAGE;
}