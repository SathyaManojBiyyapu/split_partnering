// Category configuration - single source of truth for all categories
// Maps category slugs to their display info and default images

export interface CategoryConfig {
  name: string;
  slug: string;
  icon: string;
  subtitle: string;
  defaultImage: string;
  subcategories: string[];
  savings: string;
}

// Category display config used across the app
export const categoryConfigs: Record<string, CategoryConfig> = {
  gym: {
    name: "Gym",
    slug: "gym",
    icon: "💪",
    subtitle: "Shared memberships",
    defaultImage: "/gym.webp",
    savings: "60%",
    subcategories: ["Gym Membership Split", "Supplements Group Buy", "Personal Trainer Split", "Day Pass Sharing", "Fitness Equipment Group Buy"],
  },
  fashion: {
    name: "Fashion",
    slug: "fashion",
    icon: "👗",
    subtitle: "Group shopping deals",
    defaultImage: "/fashion.webp",
    savings: "40%",
    subcategories: ["Group Shopping", "Sneakers"],
  },
  movies: {
    name: "Movies",
    slug: "movies",
    icon: "🎬",
    subtitle: "Movie ticket partnerships",
    defaultImage: "/movies.webp",
    savings: "50%",
    subcategories: ["Save Ticket", "Bulk Ticket"],
  },
  "local-travel": {
    name: "Local Travel",
    slug: "local-travel",
    icon: "✈️",
    subtitle: "Ride sharing",
    defaultImage: "/travel.webp",
    savings: "45%",
    subcategories: ["Trip Cost Sharing", "Carpool", "Hotel Sharing", "Travel Groups", "Travel Partner", "Backpacking Groups"],
  },
  books: {
    name: "Books",
    slug: "books",
    icon: "📚",
    subtitle: "Shared learning",
    defaultImage: "/books.webp",
    savings: "50%",
    subcategories: ["Book Exchange", "Second-Hand Books", "Competitive Exam Books", "Engineering Books", "Academic Books", "Novel Community", "Group Book Purchases"],
  },
  events: {
    name: "Events",
    slug: "events",
    icon: "🎤",
    subtitle: "Group event access",
    defaultImage: "/events.webp",
    savings: "30%",
    subcategories: ["Event Passes"],
  },
  coupons: {
    name: "Coupons",
    slug: "coupons",
    icon: "🎟️",
    subtitle: "Daily deals",
    defaultImage: "/coupons.webp",
    savings: "55%",
    subcategories: ["Discount Coupons"],
  },
  villas: {
    name: "Villas",
    slug: "villas",
    icon: "🏡",
    subtitle: "Shared stays",
    defaultImage: "/villas.webp",
    savings: "40%",
    subcategories: ["Weekend Stay"],
  },
};

// Get default image for a category
export function getDefaultImage(categorySlug: string): string {
  return categoryConfigs[categorySlug]?.defaultImage || "/placeholder.webp";
}

// Get category display name from slug
export function getCategoryName(categorySlug: string): string {
  return categoryConfigs[categorySlug]?.name || categorySlug;
}

// All category slugs
export const allCategorySlugs = Object.keys(categoryConfigs);

// Future categories that can inherit the same structure
export const futureCategorySlugs = [
  "salons",
  "hospitals",
  "cafes",
  "restaurants",
  "sports-clubs",
  "libraries",
  "coworking",
  "tuition-centers",
  "bike-rentals",
  "car-rentals",
  "electronics",
];