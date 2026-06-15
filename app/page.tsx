"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ================= TYPES ================= */

type CategoryCard = {
  slug: string;
  label: string;
  icon: string;
  savings: string;
  members: number;
  required: number;
  timeLeft: string;
  trending: boolean;
};

type ActivityItem = {
  id: number;
  text: string;
  emoji: string;
  time: string;
};

type SuccessStory = {
  name: string;
  saved: string;
  category: string;
  avatar: string;
};

type LeaderboardEntry = {
  rank: number;
  category: string;
  saved: string;
  icon: string;
};

/* ================= DATA ================= */

const categories: CategoryCard[] = [
  { slug: "gym", label: "Gym", icon: "/gym.webp", savings: "60%", members: 3, required: 5, timeLeft: "2 Days", trending: true },
  { slug: "fashion", label: "Fashion", icon: "/fashion.webp", savings: "40%", members: 2, required: 4, timeLeft: "3 Days", trending: true },
  { slug: "movies", label: "Movies", icon: "/movies.webp", savings: "50%", members: 4, required: 5, timeLeft: "1 Day", trending: false },
  { slug: "lenskart", label: "Lenskart", icon: "/lenskart.png", savings: "35%", members: 2, required: 4, timeLeft: "5 Days", trending: false },
  { slug: "local-travel", label: "Local Travel", icon: "/travel.webp", savings: "45%", members: 1, required: 3, timeLeft: "4 Days", trending: true },
  { slug: "events", label: "Events", icon: "/events.webp", savings: "30%", members: 3, required: 6, timeLeft: "6 Days", trending: false },
  { slug: "coupons", label: "Coupons", icon: "/coupons.webp", savings: "55%", members: 2, required: 3, timeLeft: "2 Days", trending: false },
  { slug: "villas", label: "Villas", icon: "/villas.webp", savings: "40%", members: 3, required: 6, timeLeft: "7 Days", trending: false },
  { slug: "books", label: "Books", icon: "/books.webp", savings: "50%", members: 4, required: 5, timeLeft: "3 Days", trending: false },
];

const realExamples = [
  { name: "Netflix Premium", savings: "₹150/month", members: "4/5 Joined", icon: "🎬" },
  { name: "Cult Fit Membership", savings: "₹500/month", members: "2/4 Joined", icon: "💪" },
  { name: "Goa Trip Group", savings: "₹4,000", members: "3/6 Joined", icon: "✈️" },
  { name: "Amazon Prime", savings: "₹100/month", members: "3/3 Joined", icon: "📦" },
  { name: "Spotify Family", savings: "₹89/month", members: "5/6 Joined", icon: "🎵" },
];

const leaderboard: LeaderboardEntry[] = [
  { rank: 1, category: "Education", saved: "₹2.3L", icon: "📚" },
  { rank: 2, category: "Travel", saved: "₹1.9L", icon: "✈️" },
  { rank: 3, category: "Fitness", saved: "₹1.4L", icon: "💪" },
  { rank: 4, category: "Entertainment", saved: "₹98K", icon: "🎬" },
  { rank: 5, category: "Shopping", saved: "₹76K", icon: "🛍️" },
];

const successStories: SuccessStory[] = [
  { name: "Rahul", saved: "₹18,000", category: "Gym Membership", avatar: "R" },
  { name: "Priya", saved: "₹7,500", category: "Movie Tickets", avatar: "P" },
  { name: "Aman", saved: "₹12,000", category: "Travel Split", avatar: "A" },
  { name: "Neha", saved: "₹9,200", category: "Fashion Deals", avatar: "N" },
  { name: "Vikram", saved: "₹15,000", category: "Villa Stay", avatar: "V" },
];

const howItWorks = [
  { step: 1, title: "Choose Category", desc: "Pick where you want to save — movies, gym, travel & more", icon: "🎯" },
  { step: 2, title: "Join Matching Pool", desc: "Get automatically matched with people nearby", icon: "🔗" },
  { step: 3, title: "Get Matched", desc: "System finds compatible partners based on location", icon: "🤝" },
  { step: 4, title: "Unlock Savings", desc: "Split costs and save together", icon: "💰" },
];

const liveActivities: ActivityItem[] = [
  { id: 1, text: "Education Group Completed — ₹12,000 saved", emoji: "🎓", time: "2m ago" },
  { id: 2, text: "5 Members Joined Travel Group", emoji: "👥", time: "5m ago" },
  { id: 3, text: "Netflix Group Ready — ₹150/month each", emoji: "🎬", time: "8m ago" },
  { id: 4, text: "Gym Partnership Formed in Guntur", emoji: "💪", time: "12m ago" },
  { id: 5, text: "Cult Fit Group reached 3/4 members", emoji: "🏋️", time: "15m ago" },
  { id: 6, text: "Villa Stay Split — ₹4,000 per person", emoji: "🏡", time: "20m ago" },
];

/* ================= ANIMATED COUNTER ================= */

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

/* ================= PAGE ================= */

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);
  const [filter, setFilter] = useState("All");
  const [calcMembers, setCalcMembers] = useState(3);
  const [calcCategory, setCalcCategory] = useState("Netflix");
  const [currentActivity, setCurrentActivity] = useState(0);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  /* Live activity rotation */
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentActivity((prev) => (prev + 1) % liveActivities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const savingsMap: Record<string, { monthly: number; total: number }> = {
    "Netflix": { monthly: 150, total: 1800 },
    "Spotify": { monthly: 89, total: 1068 },
    "Cult Fit": { monthly: 500, total: 6000 },
    "Amazon Prime": { monthly: 100, total: 1200 },
    "Gym Membership": { monthly: 2000, total: 24000 },
  };

  const calcSavings = savingsMap[calcCategory] || { monthly: 200, total: 2400 };
  const yourSavings = Math.round(calcSavings.monthly - (calcSavings.monthly / calcMembers));

  const filteredCategories = categories.filter((cat) => {
    if (filter === "All") return true;
    if (filter === "Popular") return ["gym", "movies", "fashion"].includes(cat.slug);
    if (filter === "Trending") return cat.trending;
    if (filter === "Almost Full") return cat.members / cat.required >= 0.75;
    return true;
  });

  return (
    <main className="min-h-screen bg-black text-white font-body pb-mobile-cta">

      {/* ================= HERO (Section 1) ================= */}
      <section className="relative min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center overflow-hidden">
        {/* Animated grid background */}
        <div className="hero-grid-bg" />
        
        {/* Particles */}
        <div className="hero-particles">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${6 + Math.random() * 6}s`,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center px-4 pt-16 sm:pt-20">
          {/* Floating category cards (Section 1) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-6"
          >
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {["🎓 Education", "💪 Gym", "🎬 Movies", "✈️ Travel", "🛍️ Fashion"].map((item, i) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="glass px-4 py-2 rounded-full text-sm text-[#FFD166]"
                >
                  {item}
                </motion.span>
              ))}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-[#FFD166] mb-4 leading-tight"
          >
            Sync. Split.
            <br />
            <span className="text-white/90">Save Together.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-8"
          >
            PartnerSync helps people collaborate intelligently
            to reduce everyday expenses. Find partners near you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex justify-center gap-4 flex-wrap"
          >
            <Link href="/categories" className="btn-primary text-sm sm:text-base">
              Explore Partnerships
            </Link>
            <a href="#stats" className="btn-outline text-sm sm:text-base">
              See Impact →
            </a>
          </motion.div>

          {/* Animated Statistics (Section 1) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            id="stats"
          >
            {[
              { value: 1247, label: "Active Groups", suffix: "" },
              { value: 1240000, label: "Saved This Month", prefix: "₹", suffix: "" },
              { value: 84, label: "Match Success Rate", suffix: "%" },
            ].map((stat, i) => (
              <div key={i} className="glass-strong rounded-xl p-4 text-center">
                <p className="text-2xl sm:text-3xl font-heading text-[#FFD166]">
                  {stat.prefix || ""}
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================= TRUST SECTION (Section 7) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Built on Trust
          </h2>
          <p className="text-gray-400 text-sm text-center mb-10 max-w-xl mx-auto">
            Every feature designed with security and transparency in mind
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { icon: "🔒", title: "Secure Payments", desc: "Protected transactions" },
              { icon: "💯", title: "Verified Members", desc: "Real people, real profiles" },
              { icon: "⚡", title: "Smart Matching", desc: "AI-powered partner finder" },
              { icon: "🛡️", title: "Privacy First", desc: "Your data stays safe" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="trust-card text-center"
              >
                <div className="text-2xl mb-2">{item.icon}</div>
                <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SOCIAL PROOF (Section 8) ================= */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            {[
              { icon: "⭐", value: 4.9, label: "Rating", suffix: "" },
              { icon: "👥", value: 10000, label: "Users", suffix: "+" },
              { icon: "💰", value: 1000000, label: "Saved", prefix: "₹", suffix: "+" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="card-glass-premium p-5"
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <p className="text-2xl sm:text-3xl font-heading text-[#FFD166]">
                  {item.prefix || ""}{item.value}{item.suffix}
                </p>
                <p className="text-xs text-gray-400 mt-1">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= LIVE ACTIVITY FEED (Section 9) ================= */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl text-[#FFD166] mb-6 text-center">
            Live Activity
          </h2>

          <div className="glass-strong rounded-2xl p-5 max-w-xl mx-auto overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentActivity}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-3"
              >
                <span className="text-xl">{liveActivities[currentActivity].emoji}</span>
                <p className="text-sm text-gray-300 flex-1">{liveActivities[currentActivity].text}</p>
                <span className="text-[10px] text-gray-500">{liveActivities[currentActivity].time}</span>
              </motion.div>
            </AnimatePresence>

            {/* Activity dots */}
            <div className="flex justify-center gap-1.5 mt-3">
              {liveActivities.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === currentActivity ? "bg-[#FFD166] w-3" : "bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= REAL CATEGORY EXAMPLES (Section 10) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Real Savings Examples
          </h2>
          <p className="text-gray-400 text-sm text-center mb-8">
            See how much people are saving right now
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {realExamples.map((example, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-premium p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{example.icon}</span>
                  <h3 className="text-white font-semibold text-sm">{example.name}</h3>
                </div>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p>Save: <span className="text-green-400 font-bold">{example.savings}</span></p>
                  <p>Members: <span className="text-[#FFD166]">{example.members}</span></p>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${(parseInt(example.members) / 6) * 100}%` }}
                    />
                  </div>
                </div>
                <Link
                  href="/categories"
                  className="mt-3 inline-block text-[10px] text-[#FFD166] hover:underline"
                >
                  Join Group →
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= URGENCY SYSTEM (Section 11) ================= */}
      <section className="py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3 justify-center">
          <span className="badge-urgent">
            🔥 Last Member Needed — Education Group
          </span>
          <span className="badge-urgent">
            ⏳ Closing In 3 Hours — Movies Group
          </span>
          <span className="badge-urgent">
            🔥 Almost Full — Gym Partnership
          </span>
        </div>
      </section>

      {/* ================= CATEGORY FILTERING (Section 14) ================= */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Partnership Categories
          </h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Find your perfect savings match
          </p>

          {/* Filter tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {["All", "Popular", "Trending", "Almost Full"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`filter-tab ${filter === tab ? "active" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Category Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCategories.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <Link
                  href={`/options/${cat.slug}`}
                  className="card-premium block p-5 h-full"
                >
                  {/* Category Icon + Name */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                      <img src={cat.icon} alt={cat.label} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-sm">{cat.label}</h3>
                      <span className="text-[10px] text-green-400">Save up to {cat.savings}</span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>👥 {cat.members}/{cat.required} Joined</span>
                      <span>⏳ {cat.timeLeft}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(cat.members / cat.required) * 100}%`,
                          background: cat.members / cat.required >= 0.75
                            ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                            : "linear-gradient(90deg, #D4AF37, #E6C97A)",
                        }}
                      />
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-4">
                    <span className="inline-block w-full text-center py-2 rounded-lg text-xs font-bold bg-[#D4AF37]/20 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30 transition-all">
                      {cat.members >= cat.required ? "🔓 Ready to Unlock" : "Join Group"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CATEGORY LEADERBOARD (Section 15) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Top Savings This Month
          </h2>
          <p className="text-gray-400 text-sm text-center mb-8">
            Categories generating the most savings
          </p>

          <div className="glass-strong rounded-2xl overflow-hidden">
            {leaderboard.map((entry, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-5 py-4 ${
                  i < leaderboard.length - 1 ? "border-b border-gray-800" : ""
                }`}
              >
                <span className={`w-6 text-center font-bold text-sm ${
                  entry.rank === 1 ? "text-[#FFD166]" : entry.rank === 2 ? "text-gray-300" : entry.rank === 3 ? "text-amber-600" : "text-gray-500"
                }`}>
                  #{entry.rank}
                </span>
                <span className="text-lg">{entry.icon}</span>
                <span className="flex-1 text-sm text-white">{entry.category}</span>
                <span className="text-sm font-bold text-green-400">{entry.saved}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SAVINGS CALCULATOR (Section 16) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Calculate Your Savings
          </h2>
          <p className="text-gray-400 text-sm text-center mb-8">
            See how much you can save by splitting costs
          </p>

          <div className="card-premium p-6">
            {/* Category Select */}
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">What are you buying?</label>
              <select
                value={calcCategory}
                onChange={(e) => setCalcCategory(e.target.value)}
                className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#FFD166] outline-none"
              >
                {Object.keys(savingsMap).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Members Slider */}
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-1 block">
                Members: <span className="text-[#FFD166]">{calcMembers}</span>
              </label>
              <input
                type="range"
                min={2}
                max={10}
                value={calcMembers}
                onChange={(e) => setCalcMembers(parseInt(e.target.value))}
                className="w-full accent-[#FFD166]"
              />
              <div className="flex justify-between text-[10px] text-gray-500">
                <span>2</span>
                <span>10</span>
              </div>
            </div>

            {/* Result */}
            <div className="bg-black/40 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">You Save</p>
              <p className="text-3xl font-heading text-green-400">₹{yourSavings.toLocaleString()}/month</p>
              <p className="text-[10px] text-gray-500 mt-2">
                Split ₹{calcSavings.monthly} among {calcMembers} members
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= SUCCESS STORIES (Section 17) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            Success Stories
          </h2>
          <p className="text-gray-400 text-sm text-center mb-8">
            Real people saving real money
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {successStories.map((story, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-glass-premium p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#E6C97A] flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                  {story.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{story.name}</p>
                  <p className="text-[10px] text-gray-400">{story.category}</p>
                  <p className="text-xs font-bold text-green-400 mt-0.5">Saved {story.saved}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS (Section 18) ================= */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl text-center text-[#FFD166] mb-3">
            How It Works
          </h2>
          <p className="text-gray-400 text-sm text-center mb-10">
            Four simple steps to start saving
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {howItWorks.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center relative"
              >
                {/* Connecting line */}
                {i < howItWorks.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-[#D4AF37]/50 to-transparent" />
                )}

                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{step.icon}</span>
                </div>
                <div className="text-xs text-[#FFD166] font-bold mb-1">Step {step.step}</div>
                <h3 className="text-white font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-[10px] text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Animated timeline */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex justify-between items-center">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${
                    s <= 2 ? "bg-[#FFD166]" : "bg-gray-700"
                  }`} />
                  <span className={`text-[8px] mt-1 ${
                    s <= 2 ? "text-[#FFD166]" : "text-gray-600"
                  }`}>Step {s}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 h-0.5 bg-gradient-to-r from-[#FFD166] via-[#FFD166]/50 to-gray-700 rounded-full" />
          </div>
        </div>
      </section>

      {/* ================= CTA SECTION ================= */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl text-[#FFD166] mb-4">
            Ready to Start Saving?
          </h2>
          <p className="text-gray-400 text-sm mb-8">
            Join thousands of people already saving money through smart partnerships.
          </p>
          <Link href="/categories" className="btn-primary text-base">
            Explore Partnerships →
          </Link>
        </div>
      </section>

      {/* ================= STICKY BOTTOM CTA (Section 24) ================= */}
      <div className="sticky-bottom-cta">
        <Link
          href="/categories"
          className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm"
        >
          Explore Categories
        </Link>
      </div>

    </main>
  );
}