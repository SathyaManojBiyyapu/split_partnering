"use client";

const categories = [
  { name: "Gym", slug: "gym", emoji: "🏋️" },
  { name: "Fashion", slug: "fashion", emoji: "👗" },
  { name: "Movies", slug: "movies", emoji: "🎬" },
  { name: "Lenskart", slug: "lenskart", emoji: "👓" },
  { name: "Local Travel", slug: "local-travel", emoji: "🚗" },
  { name: "Events", slug: "events", emoji: "🎤" },
  { name: "Coupons", slug: "coupons", emoji: "🎟️" },
  { name: "Villas", slug: "villas", emoji: "🏡" },
  { name: "Books", slug: "books", emoji: "📚" },
];

export default function CategoriesPage() {
  return (
    <main className="min-h-screen pt-32 pb-32 px-6 bg-black text-center">
      {/* ===== HEADING ===== */}
      <h1 className="font-heading text-3xl sm:text-4xl mb-4 text-gold-primary">
        Choose a Category
      </h1>

      <p className="text-text-muted text-sm max-w-xl mx-auto mb-12">
        Select a category to start forming trusted partnerships and
        unlock cost-saving opportunities.
      </p>

      {/* ===== CATEGORY GRID ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {categories.map((cat) => (
          <a
            key={cat.slug}
            href={`/options/${cat.slug}`}
            className="
              group
              p-6 sm:p-8 rounded-2xl
              border border-dark-card
              bg-black
              transition-all duration-300
              hover:-translate-y-1
              hover:border-gold-primary
              hover:shadow-[0_0_28px_rgba(212,175,55,0.35)]
            "
          >
            <div className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110">
              {cat.emoji}
            </div>

            <h2 className="font-heading text-lg sm:text-xl text-text-body group-hover:text-gold-primary transition">
              {cat.name}
            </h2>
          </a>
        ))}
      </div>
    </main>
  );
}
