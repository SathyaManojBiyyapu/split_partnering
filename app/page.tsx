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

      {/* ================= HERO ================= */}
      <section className="relative min-h-[60vh] sm:min-h-[65vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-5xl mx-auto text-center px-4 pt-10 sm:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {["🎓 Education", "💪 Gym", "🎬 Movies", "✈️ Travel", "🛍️ Shopping"].map((item, i) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.08 }}
                  className="inline-block px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 text-gray-300"
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
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white mb-4 leading-tight"
          >
            Save Money
            <br />
            <span className="text-[#D4AF37]">Together.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mb-8"
          >
            Find trusted people nearby to split memberships, shopping deals, travel costs, movie tickets, eyewear purchases and more.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex justify-center gap-4 flex-wrap"
          >
            <Link
              href="/categories"
              className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base bg-[#D4AF37] text-black hover:bg-[#E6C97A] transition-all hover:-translate-y-0.5"
            >
              Explore Categories
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base border-2 border-white/20 text-white hover:bg-white/5 hover:border-white/40 transition-all hover:-translate-y-0.5"
            >
              Find Partners
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 flex items-center justify-center gap-6 text-sm text-gray-500"
          >
            <div className="flex -space-x-2">
              {["R", "P", "A", "N"].map((initial, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center text-xs font-medium text-white"
                >
                  {initial}
                </div>
              ))}
            </div>
            <span><strong className="text-white">10,000+</strong> people saving together</span>
          </motion.div>
        </div>
      </section>

      {/* ================= CATEGORY CARDS ================= */}
      <section className="py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-xl sm:text-2xl text-white">
              Start Saving Now
            </h2>
            <div className="flex gap-1">
              {["All", "Popular", "Trending", "Almost Full"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    filter === tab
                      ? "bg-[#D4AF37] text-black"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCategories.slice(0, 6).map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/options/${cat.slug}`}
                  className="block p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#D4AF37]/30 hover:bg-white/[0.06] transition-all h-full"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0">
                      <img src={cat.icon} alt={cat.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm truncate">{cat.label}</h3>
                      <span className="text-[10px] text-green-400">Save up to {cat.savings}</span>
                    </div>
                    {cat.trending && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex-shrink-0">
                        Trending
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>👥 {cat.members}/{cat.required} Joined</span>
                      <span>⏳ {cat.timeLeft}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#D4AF37] transition-all duration-500"
                        style={{ width: `${(cat.members / cat.required) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="inline-block w-full text-center py-2 rounded-lg text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 hover:bg-[#D4AF37]/20 transition-all">
                      {cat.members >= cat.required ? "🔓 Ready to Unlock" : "Join Group →"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {filteredCategories.length > 6 && (
            <div className="text-center mt-6">
              <Link href="/categories" className="text-xs text-gray-400 hover:text-[#D4AF37] transition-colors">
                View all {filteredCategories.length} categories →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ================= TRUST INDICATORS ================= */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: "✓", title: "Verified Users", desc: "OTP-authenticated real people" },
              { icon: "🔒", title: "Privacy Protected", desc: "Your data stays secure" },
              { icon: "💳", title: "Secure Payments", desc: "Encrypted transactions" },
              { icon: "📍", title: "Location Matching", desc: "Find partners near you" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-base">{item.icon}</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{item.title}</h3>
                  <p className="text-[10px] text-gray-500">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { value: 1247, label: "Active Groups", suffix: "" },
              { value: 1240000, label: "Saved This Month", prefix: "₹", suffix: "" },
              { value: 84, label: "Match Success Rate", suffix: "%" },
              { value: 10000, label: "Happy Users", suffix: "+" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-xl sm:text-2xl font-heading text-[#D4AF37]">
                  {stat.prefix || ""}
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= LIVE ACTIVITY ================= */}
      <section className="py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-heading text-lg sm:text-xl text-white mb-4 text-center">Live Activity</h2>
          <div className="max-w-xl mx-auto rounded-xl bg-white/[0.02] border border-white/10 p-4 overflow-hidden">
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
            <div className="flex justify-center gap-1.5 mt-3">
              {liveActivities.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === currentActivity ? "bg-[#D4AF37] w-3" : "bg-gray-600"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ================= SAVINGS EXAMPLES ================= */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">Real Savings Examples</h2>
          <p className="text-gray-400 text-sm text-center mb-6">See how much people are saving right now</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {realExamples.map((example, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#D4AF37]/20 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{example.icon}</span>
                  <h3 className="text-white font-medium text-sm">{example.name}</h3>
                </div>
                <div className="space-y-1.5 text-xs text-gray-400">
                  <p>Save: <span className="text-green-400 font-bold">{example.savings}</span></p>
                  <p>Members: <span className="text-[#D4AF37]">{example.members}</span></p>
                  <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${(parseInt(example.members) / 6) * 100}%` }} />
                  </div>
                </div>
                <Link href="/categories" className="mt-3 inline-block text-[10px] text-[#D4AF37] hover:underline">Join Group →</Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= URGENCY ================= */}
      <section className="py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">🔥 Last Member Needed — Education Group</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">⏳ Closing In 3 Hours — Movies Group</span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">🔥 Almost Full — Gym Partnership</span>
        </div>
      </section>

      {/* ================= LEADERBOARD ================= */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">Top Savings This Month</h2>
          <p className="text-gray-400 text-sm text-center mb-6">Categories generating the most savings</p>
          <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
            {leaderboard.map((entry, i) => (
              <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${i < leaderboard.length - 1 ? "border-b border-white/5" : ""}`}>
                <span className={`w-6 text-center font-bold text-sm ${entry.rank === 1 ? "text-[#D4AF37]" : entry.rank === 2 ? "text-gray-300" : entry.rank === 3 ? "text-amber-600" : "text-gray-500"}`}>#{entry.rank}</span>
                <span className="text-lg">{entry.icon}</span>
                <span className="flex-1 text-sm text-white">{entry.category}</span>
                <span className="text-sm font-bold text-green-400">{entry.saved}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SAVINGS CALCULATOR ================= */}
      <section className="py-12 px-4">
        <div className="max-w-lg mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">Calculate Your Savings</h2>
          <p className="text-gray-400 text-sm text-center mb-6">See how much you can save by splitting costs</p>
          <div className="p-6 rounded-xl bg-white/[0.02] border border-white/10">
            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">What are you buying?</label>
              <select value={calcCategory} onChange={(e) => setCalcCategory(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] outline-none">
                {Object.keys(savingsMap).map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            </div>
            <div className="mb-6">
              <label className="text-xs text-gray-400 mb-1 block">Members: <span className="text-[#D4AF37]">{calcMembers}</span></label>
              <input type="range" min={2} max={10} value={calcMembers} onChange={(e) => setCalcMembers(parseInt(e.target.value))} className="w-full accent-[#D4AF37]" />
              <div className="flex justify-between text-[10px] text-gray-500"><span>2</span><span>10</span></div>
            </div>
            <div className="bg-black/40 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">You Save</p>
              <p className="text-3xl font-heading text-green-400">₹{yourSavings.toLocaleString()}/month</p>
              <p className="text-[10px] text-gray-500 mt-2">Split ₹{calcSavings.monthly} among {calcMembers} members</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">How It Works</h2>
          <p className="text-gray-400 text-sm text-center mb-8">Four simple steps to start saving</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {howItWorks.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center relative">
                {i < howItWorks.length - 1 && (<div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#D4AF37]/30 to-transparent" />)}
                <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-3"><span className="text-xl">{step.icon}</span></div>
                <div className="text-[10px] text-[#D4AF37] font-semibold mb-1">Step {step.step}</div>
                <h3 className="text-white font-medium text-sm mb-1">{step.title}</h3>
                <p className="text-[10px] text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl text-white mb-3">Ready to Start Saving?</h2>
          <p className="text-gray-400 text-sm mb-6">Join thousands of people already saving money through smart partnerships.</p>
          <Link href="/categories" className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-sm bg-[#D4AF37] text-black hover:bg-[#E6C97A] transition-colors">Explore Categories</Link>
        </div>
      </section>

      {/* ================= STICKY BOTTOM CTA ================= */}
      <div className="sticky-bottom-cta">
        <Link href="/categories" className="block w-full text-center py-3 rounded-xl font-bold bg-[#D4AF37] text-black text-sm">Explore Categories</Link>
      </div>

    </main>
  );
}