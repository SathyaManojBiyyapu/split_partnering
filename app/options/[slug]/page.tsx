"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { categoryData, Subcategory, slugToCategoryName } from "@/app/data/subcategories";
import CategoryImage from "@/app/components/ui/CategoryImage";
import CompatibilityInsight from "@/app/components/ui/CompatibilityInsight";

/* ---------------- ANIMATED COUNTER ---------------- */
function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let start = 0;
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [visible, target]);

  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

/* ---------------- SUB CATEGORY CARD ---------------- */
function SubcategoryCard({ sub, slug, index }: { sub: Subcategory; slug: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
    >
      <Link
        href={`/save?category=${slug}&option=${sub.slug}`}
        className="card-premium block p-5 h-full"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/20 flex items-center justify-center text-xl flex-shrink-0">
            {sub.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight">{sub.name}</h3>
            <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{sub.description}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-2.5 py-1.5 flex-shrink-0">
            <p className="text-green-400 text-xs font-bold">-{sub.savings}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-[#FFD166] text-xs font-bold">{sub.usersSearching}</p>
            <p className="text-[8px] text-gray-500">Searching</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-green-400 text-xs font-bold">{sub.avgSavingsPercent}%</p>
            <p className="text-[8px] text-gray-500">Avg Savings</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-blue-400 text-xs font-bold">{sub.matchesToday}</p>
            <p className="text-[8px] text-gray-500">Today</p>
          </div>
          <div className="bg-black/30 rounded-lg p-2 text-center">
            <p className="text-purple-400 text-xs font-bold">₹{sub.potentialSavings.toLocaleString()}</p>
            <p className="text-[8px] text-gray-500">Potential</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Match Progress</span>
            <span>{sub.matchesToday}/100 today</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full progress-active"
              style={{ width: `${Math.min((sub.matchesToday / 100) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-3">
          <span>👥 {sub.groupsFormed} groups formed</span>
          <span>⏱ Avg {sub.avgMatchTimeMinutes} min</span>
        </div>

        <div className="mt-auto">
          <span className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30">
            Find Partners →
          </span>
        </div>

        {sub.options && sub.options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {sub.options.map((opt) => (
              <span key={opt} className="text-[8px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
                {opt}
              </span>
            ))}
          </div>
        )}
      </Link>
    </motion.div>
  );
}

/* ---------------- PAGE ---------------- */
export default function OptionsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const data = categoryData[slug];

  if (!data) {
    return (
      <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
        <h1 className="text-3xl font-semibold text-[#FFD166]">Category not found</h1>
        <Link href="/categories" className="text-[#FFD166] hover:underline mt-4 inline-block">
          ← Back to Categories
        </Link>
      </div>
    );
  }

  const totalSearching = data.subcategories.reduce((sum, s) => sum + s.usersSearching, 0);
  const totalMatchesToday = data.subcategories.reduce((sum, s) => sum + s.matchesToday, 0);

  return (
    <main className="min-h-screen bg-black text-white pb-mobile-cta">

      {/* ===== 1. CATEGORY BANNER ===== */}
      <section className="relative h-48 sm:h-56 md:h-64 overflow-hidden">
        <div className="absolute inset-0">
          <CategoryImage
            categorySlug={slug}
            alt={data.title}
            fill
            className="object-cover object-center"
            priority
            fallbackIcon={data.icon}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col justify-end p-6 sm:p-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{data.icon}</span>
            <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl text-[#FFD166]">
              {data.title}
            </h1>
          </div>
          <p className="text-gray-300 text-xs sm:text-sm max-w-2xl">
            {data.description}
          </p>
        </div>
      </section>

      {/* ===== 2. CATEGORY STATISTICS ===== */}
      <section className="px-4 -mt-8 relative z-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: data.activeUsers, label: "Active Users", color: "text-blue-400", suffix: "" },
              { value: data.groupsCreated, label: "Groups Created", color: "text-green-400", suffix: "" },
              { value: 0, label: "Money Saved", color: "text-[#FFD166]", prefix: "₹", suffix: "" },
              { value: 0, label: "Avg Match Time", color: "text-purple-400", suffix: "" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="glass-strong rounded-xl p-3 sm:p-4 text-center"
              >
                {stat.label === "Money Saved" ? (
                  <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>{data.moneySaved}</p>
                ) : stat.label === "Avg Match Time" ? (
                  <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>{data.avgMatchTime}</p>
                ) : (
                  <p className={`text-lg sm:text-xl font-bold ${stat.color}`}>
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                  </p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 3. SAVINGS OPPORTUNITIES HEADER ===== */}
      <section className="px-4 mt-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h2 className="font-heading text-xl sm:text-2xl text-[#FFD166]">
              Save Money On
            </h2>
            <div className="text-xs text-gray-500">
              {totalSearching} searching · {totalMatchesToday} matched today
            </div>
          </div>
          <p className="text-gray-400 text-xs mb-6">
            {data.subcategories.length} ways to save with partners near you
          </p>
        </div>
      </section>

      {/* ===== 4. SUBCATEGORY CARDS ===== */}
      <section className="px-4 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.subcategories.map((sub, i) => (
              <SubcategoryCard key={sub.slug} sub={sub} slug={slug} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== CUSTOM GROUP CTA ===== */}
      <section className="px-4 py-2">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/create-group?category=${slug}`}
            className="block w-full p-5 rounded-2xl border border-dashed border-[#D4AF37]/40 bg-[#D4AF37]/5 text-center hover:bg-[#D4AF37]/10 transition-all hover:-translate-y-0.5"
          >
            <p className="text-[#FFD166] font-semibold text-sm sm:text-base">
              ➕ Don't see your subcategory? Create your own group →
            </p>
            <p className="text-gray-400 text-[10px] sm:text-xs mt-1">
              Start a new partner request under {data.title} with your own custom option. Groups stay locked to this category.
            </p>
          </Link>
        </div>
      </section>

      {/* ===== 5. COMPATIBILITY / MATCHING INSIGHT ===== */}
      <CompatibilityInsight
        slug={slug}
        categoryTitle={data.title}
        ctaHref={`/save?category=${slug}&option=${data.subcategories[0]?.slug || ""}`}
      />

      {/* ===== BACK LINK ===== */}
      <div className="px-4 pb-8 text-center">
        <Link href="/categories" className="text-[#FFD166] hover:underline text-xs">
          ← Back to Categories
        </Link>
      </div>

      {/* ===== STICKY BOTTOM CTA ===== */}
      <div className="sticky-bottom-cta">
        <Link
          href={`/save?category=${slug}&option=${data.subcategories[0]?.slug || ""}`}
          className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm"
        >
          Find Partners
        </Link>
      </div>

    </main>
  );
}