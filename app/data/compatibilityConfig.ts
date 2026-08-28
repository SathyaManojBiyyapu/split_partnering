// Category-specific "Compatibility / Matching Insight" configuration.
// Single source of truth for the premium matching-insight section rendered
// below the subcategory grid on /options/[slug]. Each category gets its own
// score, headline, description, accent colors, illustration icon and the
// 4 weighted matching factors used to visually explain how PartnerSync
// matches people for that category.

import {
  type LucideIcon,
  Dumbbell,
  MapPin,
  CalendarClock,
  Ruler,
  Palette,
  ShoppingBag,
  Wallet,
  Compass,
  Heart,
  CalendarDays,
  Luggage,
  Ticket,
  CalendarCheck,
  Users,
  Mic,
  Tv,
  Repeat,
  Gauge,
  Home,
  Sofa,
  BedDouble,
  BadgePercent,
  ShoppingCart,
  Tag,
  BookOpen,
  GraduationCap,
  NotebookText,
  Wrench,
  Clock,
  Settings2,
} from "lucide-react";

export interface MatchingFactor {
  label: string;
  weight: number; // percentage weight, all 4 should sum to 100
  icon: LucideIcon;
}

export interface CompatibilityAccent {
  primary: string; // main accent hex
  secondary: string; // gradient partner hex
  glow: string; // rgba glow color used for shadows/backgrounds
}

export interface CompatibilityConfig {
  ctaLabel: string;
  score: number; // 0-100
  headlineLines: string[]; // rendered as stacked lines
  description: string;
  accent: CompatibilityAccent;
  illustrationIcon: LucideIcon;
  factors: MatchingFactor[]; // exactly 4 factors
}

// Keyed by the same category slug used in app/data/subcategories.ts (categoryData)
export const compatibilityConfigs: Record<string, CompatibilityConfig> = {
  gym: {
    ctaLabel: "Find Your Fit",
    score: 89,
    headlineLines: ["Not just reps.", "Real results together."],
    description:
      "We match your fitness goals, workout style, location, and schedule to help you find the right gym partner.",
    accent: { primary: "#EF4444", secondary: "#D4AF37", glow: "rgba(239, 68, 68, 0.18)" },
    illustrationIcon: Dumbbell,
    factors: [
      { label: "Fitness Goals", weight: 30, icon: Dumbbell },
      { label: "Location Match", weight: 25, icon: MapPin },
      { label: "Schedule Sync", weight: 20, icon: CalendarClock },
      { label: "Workout Style", weight: 25, icon: Ruler },
    ],
  },

  "local-travel": {
    ctaLabel: "Explore Together",
    score: 92,
    headlineLines: ["Better trips.", "Better memories."],
    description:
      "We match your travel vibe, budget, interests, and dates to help you find the right travel partner.",
    accent: { primary: "#3B82F6", secondary: "#60A5FA", glow: "rgba(59, 130, 246, 0.18)" },
    illustrationIcon: Luggage,
    factors: [
      { label: "Travel Style", weight: 30, icon: Compass },
      { label: "Budget Overlap", weight: 30, icon: Wallet },
      { label: "Interests Match", weight: 20, icon: Heart },
      { label: "Date Compatibility", weight: 20, icon: CalendarDays },
    ],
  },

  events: {
    ctaLabel: "Experience More",
    score: 87,
    headlineLines: ["Great events.", "Greater company."],
    description:
      "We match your event interests, availability, location, and group preferences so you can enjoy more together.",
    accent: { primary: "#A855F7", secondary: "#C084FC", glow: "rgba(168, 85, 247, 0.18)" },
    illustrationIcon: Mic,
    factors: [
      { label: "Event Interest", weight: 30, icon: Ticket },
      { label: "Date Availability", weight: 25, icon: CalendarCheck },
      { label: "Location Match", weight: 25, icon: MapPin },
      { label: "Group Vibe", weight: 20, icon: Users },
    ],
  },

  fashion: {
    ctaLabel: "Shop Smarter",
    score: 88,
    headlineLines: ["Style is personal.", "Savings are better shared."],
    description:
      "We match your style, size, budget, and shopping preferences to help you shop more and spend less.",
    accent: { primary: "#EC4899", secondary: "#F472B6", glow: "rgba(236, 72, 153, 0.18)" },
    illustrationIcon: ShoppingBag,
    factors: [
      { label: "Style Match", weight: 30, icon: Palette },
      { label: "Budget Overlap", weight: 30, icon: Wallet },
      { label: "Size & Fit", weight: 20, icon: Ruler },
      { label: "Shopping Preferences", weight: 20, icon: ShoppingBag },
    ],
  },

  movies: {
    ctaLabel: "Share More",
    score: 91,
    headlineLines: ["Your shows.", "Our subscription.", "Everyone wins."],
    description:
      "We match your content preferences, subscription needs, budget, and usage patterns for smarter sharing.",
    accent: { primary: "#14B8A6", secondary: "#22D3EE", glow: "rgba(20, 184, 166, 0.18)" },
    illustrationIcon: Tv,
    factors: [
      { label: "Content Preference", weight: 35, icon: Tv },
      { label: "Subscription Type", weight: 25, icon: Repeat },
      { label: "Budget Overlap", weight: 20, icon: Wallet },
      { label: "Usage Pattern", weight: 20, icon: Gauge },
    ],
  },

  villas: {
    ctaLabel: "Stay Together",
    score: 90,
    headlineLines: ["Better stays.", "Better together."],
    description:
      "We match your location, budget, stay preferences, and group comfort to make every shared stay easier.",
    accent: { primary: "#F97316", secondary: "#FBBF24", glow: "rgba(249, 115, 22, 0.18)" },
    illustrationIcon: Home,
    factors: [
      { label: "Location Match", weight: 30, icon: MapPin },
      { label: "Budget Overlap", weight: 30, icon: Wallet },
      { label: "Stay Preference", weight: 20, icon: BedDouble },
      { label: "Group Comfort", weight: 20, icon: Sofa },
    ],
  },

  coupons: {
    ctaLabel: "Save More",
    score: 86,
    headlineLines: ["Big deals.", "Bigger savings."],
    description:
      "We match you with people looking for similar deals so everyone can unlock better offers together.",
    accent: { primary: "#22C55E", secondary: "#4ADE80", glow: "rgba(34, 197, 94, 0.18)" },
    illustrationIcon: Tag,
    factors: [
      { label: "Deal Interest", weight: 35, icon: BadgePercent },
      { label: "Budget Match", weight: 25, icon: Wallet },
      { label: "Shopping Habits", weight: 20, icon: ShoppingCart },
      { label: "Location Relevance", weight: 20, icon: MapPin },
    ],
  },

  // "Local Services" content applied to the Lenskart/eyewear category — the
  // only remaining unmapped slug. Lenskart is itself a local optical service,
  // so the generic "get it done together" service-matching concept fits.
  lenskart: {
    ctaLabel: "Get It Done",
    score: 85,
    headlineLines: ["Need it done?", "Let's do it together."],
    description:
      "We match similar service needs based on location, timing, and budget so you can get things done more efficiently.",
    accent: { primary: "#2563EB", secondary: "#60A5FA", glow: "rgba(37, 99, 235, 0.18)" },
    illustrationIcon: Wrench,
    factors: [
      { label: "Service Type", weight: 30, icon: Settings2 },
      { label: "Location Match", weight: 25, icon: MapPin },
      { label: "Time Preference", weight: 25, icon: Clock },
      { label: "Budget Overlap", weight: 20, icon: Wallet },
    ],
  },

  books: {
    ctaLabel: "Learn Together",
    score: 87,
    headlineLines: ["Learn more.", "Spend less.", "Grow together."],
    description:
      "We match your learning interests, course or book preferences, budget, and learning style to make learning more collaborative.",
    accent: { primary: "#8B5CF6", secondary: "#A78BFA", glow: "rgba(139, 92, 246, 0.18)" },
    illustrationIcon: BookOpen,
    factors: [
      { label: "Learning Interest", weight: 30, icon: BookOpen },
      { label: "Course/Book Type", weight: 25, icon: GraduationCap },
      { label: "Budget Overlap", weight: 25, icon: Wallet },
      { label: "Learning Style", weight: 20, icon: NotebookText },
    ],
  },
};

// Safe getter with a sensible fallback so a missing/new category slug never crashes the page.
export function getCompatibilityConfig(slug: string): CompatibilityConfig {
  return (
    compatibilityConfigs[slug] || {
      ctaLabel: "Get Matched",
      score: 85,
      headlineLines: ["Better together.", "Smarter savings."],
      description:
        "We match your preferences, budget, location, and timing to help you find the right partner in this category.",
      accent: { primary: "#D4AF37", secondary: "#E6C97A", glow: "rgba(212, 175, 55, 0.18)" },
      illustrationIcon: Users,
      factors: [
        { label: "Preference Match", weight: 30, icon: Heart },
        { label: "Location Match", weight: 25, icon: MapPin },
        { label: "Schedule Sync", weight: 25, icon: CalendarClock },
        { label: "Budget Overlap", weight: 20, icon: Wallet },
      ],
    }
  );
}

