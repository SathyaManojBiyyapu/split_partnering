"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* ================= TYPES ================= */

type FeaturedDeal = {
  label: string;
  categorySlug: string;
  optionSlug?: string;
  tagline: string;
  emoji: string;
};

type CategoryCard = {
  slug: string;
  label: string;
  emoji: string;
  line: string;
};

/* ================= DATA ================= */

const featuredDeals: FeaturedDeal[] = [
  {
    label: "Zara Discount Split",
    categorySlug: "fashion",
    tagline: "Collaborate on seasonal fashion purchases.",
    emoji: "👗",
  },
  {
    label: "Gym Membership Partner",
    categorySlug: "gym",
    tagline: "Reduce fitness costs through shared plans.",
    emoji: "🏋️",
  },
  {
    label: "Airport Cab Split",
    categorySlug: "local-travel",
    tagline: "Lower travel expenses through route matching.",
    emoji: "🚗",
  },
];

const categories: CategoryCard[] = [
  { slug: "gym", label: "Gym", emoji: "🏋️", line: "Shared memberships & supplements." },
  { slug: "fashion", label: "Fashion", emoji: "👗", line: "Partner-driven brand offers." },
  { slug: "movies", label: "Movies", emoji: "🎬", line: "Split tickets & combos." },
  { slug: "lenskart", label: "Lenskart", emoji: "👓", line: "Shared eyewear deals." },
  { slug: "local-travel", label: "Local Travel", emoji: "🚘", line: "Cab, bike & route sharing." },
  { slug: "events", label: "Events", emoji: "🎤", line: "Concerts & experiences." },
  { slug: "coupons", label: "Coupons", emoji: "🎟️", line: "Unused offers unlocked." },
  { slug: "villas", label: "Villas", emoji: "🏡", line: "Group stays, optimized pricing." },
  { slug: "books", label: "Books", emoji: "📚", line: "Shared access to study material." },
];

/* ================= PAGE ================= */

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  return (
    <main className="min-h-screen bg-black text-text-body font-body">

      {/* ================= HERO ================= */}
      <section className="pt-36 pb-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl tracking-tight text-gold-primary mb-4">
            Sync. Split. Save.
          </h1>

          <p className="text-text-muted text-sm sm:text-base max-w-xl mx-auto mb-10">
            PartnerSync helps people collaborate intelligently
            to reduce everyday expenses.
          </p>

          <div className="flex justify-center gap-4">
            <Link href="/categories" className="btn-primary">
              Explore Partnerships
            </Link>
            <a href="#stats" className="btn-outline">
              Why PartnerSync?
            </a>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section id="stats" className="pb-24 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="rounded-2xl border border-dark-card bg-dark-section p-6">
            <p className="text-3xl font-heading text-gold-primary">₹10L+</p>
            <p className="text-sm text-text-muted mt-1">Estimated savings enabled</p>
          </div>
          <div className="rounded-2xl border border-dark-card bg-dark-section p-6">
            <p className="text-3xl font-heading text-gold-primary">1,000+</p>
            <p className="text-sm text-text-muted mt-1">Partner matches formed</p>
          </div>
          <div className="rounded-2xl border border-dark-card bg-dark-section p-6">
            <p className="text-3xl font-heading text-gold-primary">9+</p>
            <p className="text-sm text-text-muted mt-1">Active categories</p>
          </div>
        </div>
      </section>

      {/* ================= FEATURED DEALS ================= */}
      <section className="pb-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl mb-2">
            Active partnerships
          </h2>
          <p className="text-text-muted text-sm mb-8">
            Real use-cases with live activity.
          </p>

          <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
            {featuredDeals.map((deal) => (
              <Link
                key={deal.label}
                href={`/options/${deal.categorySlug}`}
                className="
                  min-w-[220px] snap-start
                  rounded-2xl border border-dark-card
                  bg-dark-section px-5 py-6
                  hover:-translate-y-1
                  hover:shadow-[0_0_30px_rgba(212,175,55,0.25)]
                  transition
                "
              >
                <div className="text-3xl mb-3">{deal.emoji}</div>
                <h3 className="font-heading text-lg mb-1">{deal.label}</h3>
                <p className="text-sm text-text-muted">{deal.tagline}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= WHY PARTNERSYNC ================= */}
      <section className="pb-28 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl mb-6">
            Why PartnerSync exists
          </h2>

          <p className="text-text-muted text-sm leading-relaxed">
          Many everyday purchases become significantly cheaper when people collaborate.
Yet most group-buying efforts fail due to lack of trust, coordination, and clarity.

PartnerSync exists to solve that gap.

We provide a structured platform where individuals can safely form
cost-sharing partnerships, with clear group limits, transparent status,
and admin oversight — removing chaos from collaboration.

No selling. No pressure.
Just smart coordination, built to scale.  

You don’t negotiate.
You don’t chase people.
You don’t manage chaos.

The system does it for you.

1. Choose a Category

Select where you want to save — movies, gym, travel, villas, fashion, and more.
Each category is designed for cost-sharing opportunities.

2. Join or Create a Group

When you select an option, PartnerSync automatically places you into a capacity-based group.
Groups are formed only when there is real intent, not noise.

You can see:

How many members have joined

How many are still needed

The group’s current status (waiting / ready)

3. Smart Matching in Action

PartnerSync continuously matches users based on:

Category choice

Timing

Required group size

This ensures fair, optimized grouping — without manual coordination.

4. Admin-Moderated Coordination

Once a group is ready, coordination happens in a controlled, transparent way.

No forced sharing of details

No direct spam

Admin ensures clarity before any transaction

This keeps collaboration safe and trustworthy.

5. Collaborate. Split. Save.

When the group completes:

Costs are shared

Benefits are unlocked

Everyone saves together

Simple collaboration. Real savings.
          </p>
        </div>
      </section>

      {/* ================= CATEGORIES ================= */}
      <section className="pb-28 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl mb-2">
            Partnership categories
          </h2>

          <p className="text-text-muted text-sm mb-10">
            Built for both daily needs and high-value spends.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/options/${cat.slug}`}
                className="
                  rounded-2xl border border-dark-card
                  bg-dark-section px-5 py-6
                  hover:-translate-y-1
                  hover:shadow-[0_0_24px_rgba(212,175,55,0.2)]
                  transition
                "
              >
                <div className="text-2xl mb-3">{cat.emoji}</div>
                <h3 className="font-heading text-lg mb-1">{cat.label}</h3>
                <p className="text-sm text-text-muted">{cat.line}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="pb-28 px-6 border-t border-dark-card">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-2xl sm:text-3xl mb-2">
            How it works
          </h2>

          <p className="text-text-muted text-sm mb-10">
            Simple. Structured. Effective.
          </p>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl bg-dark-section border border-dark-card p-5">
              <p className="font-heading mb-1">1 · Sync</p>
              <p className="text-sm text-text-muted">Select a category & intent.</p>
            </div>
            <div className="rounded-2xl bg-dark-section border border-dark-card p-5">
              <p className="font-heading mb-1">2 · Split</p>
              <p className="text-sm text-text-muted">Get matched with partners.</p>
            </div>
            <div className="rounded-2xl bg-dark-section border border-dark-card p-5">
              <p className="font-heading mb-1">3 · Save</p>
              <p className="text-sm text-text-muted">Complete with reduced cost.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUST ================= */}
      <section className="pb-28 px-6 border-t border-dark-card">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-2xl sm:text-3xl mb-4">
            Transparency & trust
          </h2>

          <p className="text-text-muted text-sm leading-relaxed">
            PartnerSync does not sell products or tickets.
            We only enable partner discovery and admin coordination.
            Users remain in control of transactions and communication.
          </p>
        </div>
      </section>

    </main>
  );
}
