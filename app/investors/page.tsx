"use client";

import Link from "next/link";

export default function InvestorsPage() {
  return (
    <main className="min-h-screen px-6 pt-28 pb-32 font-body">
      <div className="max-w-5xl mx-auto">

        {/* ================= HERO ================= */}
        <section className="text-center mb-24">
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl mb-6">
            Building the infrastructure for
            <br />
            smarter cost-sharing partnerships
          </h1>

          <p className="text-text-muted text-sm sm:text-lg max-w-3xl mx-auto mb-10">
            PartnerSync is a collaboration platform that enables individuals and
            businesses to reduce costs through structured, trusted partnerships
            across high-demand categories.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a href="#contact" className="btn-primary">
              Talk to Founders
            </a>

            <a href="#deck" className="btn-outline">
              View Pitch Overview
            </a>
          </div>
        </section>

        {/* ================= PROBLEM / SOLUTION ================= */}
        <section className="mb-24 grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-heading text-2xl sm:text-3xl mb-4">
              The problem
            </h2>
            <p className="text-text-muted leading-relaxed">
              Millions of consumers and small businesses overpay for products,
              services, and subscriptions due to fragmented demand and lack of
              coordination. Existing marketplaces focus on selling more — not
              on helping users collaborate to pay less.
            </p>
          </div>

          <div>
            <h2 className="font-heading text-2xl sm:text-3xl mb-4">
              Our solution
            </h2>
            <p className="text-text-muted leading-relaxed">
              PartnerSync enables users to form verified partner groups based on
              intent, location, and timing — unlocking shared purchases, bundled
              deals, and cost-optimized access without becoming a traditional
              marketplace.
            </p>
          </div>
        </section>

        {/* ================= WHY PARTNERSYNC ================= */}
        <section className="mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-10 text-center">
            Why PartnerSync
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading mb-2">Demand-first model</h3>
              <p className="text-sm text-text-muted">
                We aggregate demand before transactions occur, improving
                pricing power and conversion efficiency.
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading mb-2">Category-agnostic</h3>
              <p className="text-sm text-text-muted">
                From fitness and travel to fashion and education, the platform
                scales horizontally across verticals.
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading mb-2">Asset-light & scalable</h3>
              <p className="text-sm text-text-muted">
                No inventory, no logistics — PartnerSync focuses on matching,
                coordination, and value capture.
              </p>
            </div>
          </div>
        </section>

        {/* ================= MARKET OPPORTUNITY ================= */}
        <section className="mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-6">
            Market opportunity
          </h2>

          <p className="text-text-muted max-w-4xl leading-relaxed">
            PartnerSync operates at the intersection of consumer savings,
            shared-economy behavior, and digital coordination. The global
            consumer services and subscription economy represents a
            multi-trillion-dollar opportunity, with increasing user willingness
            to collaborate for better pricing.
          </p>
        </section>

        {/* ================= MONETIZATION ================= */}
        <section className="mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-6">
            How we make money
          </h2>

          <ul className="list-disc list-inside text-text-muted space-y-3">
            <li>Commission on successfully formed partner groups</li>
            <li>Platform fees from premium or priority matching</li>
            <li>Enterprise and brand partnership integrations</li>
            <li>Future SaaS tools for demand aggregation</li>
          </ul>
        </section>

        {/* ================= TRACTION ================= */}
        <section className="mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-6">
            Early traction
          </h2>

          <div className="grid gap-6 sm:grid-cols-3">
            <div className="border border-dark-card bg-dark-section rounded-2xl p-6 text-center">
              <p className="font-heading text-3xl text-gold-primary mb-1">
                MVP
              </p>
              <p className="text-sm text-text-muted">
                Live platform with active user flows
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6 text-center">
              <p className="font-heading text-3xl text-gold-primary mb-1">
                Multi-category
              </p>
              <p className="text-sm text-text-muted">
                Fitness, travel, fashion & more
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6 text-center">
              <p className="font-heading text-3xl text-gold-primary mb-1">
                Early users
              </p>
              <p className="text-sm text-text-muted">
                Organic interest & early usage signals
              </p>
            </div>
          </div>
        </section>

        {/* ================= CTA ================= */}
        <section id="contact" className="text-center mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-4">
            Let’s build this together
          </h2>

          <p className="text-text-muted mb-8 max-w-2xl mx-auto">
            We’re partnering with early investors who believe in demand-side
            innovation and scalable collaboration platforms.
          </p>

          <div className="flex justify-center gap-4">
            <Link href="/contact" className="btn-primary">
              Contact Founders
            </Link>

            <a id="deck" href="#" className="btn-outline">
              Request Pitch Deck
            </a>
          </div>
        </section>

        {/* ================= PHASED ROLLOUT & MONETIZATION ================= */}
        <section className="mb-24">
          <h2 className="font-heading text-2xl sm:text-3xl mb-10 text-center">
            Phased rollout & monetization strategy
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading text-lg mb-2 text-gold-primary">
                Ground Phase
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Initial phase focused on adoption and learning. PartnerSync
                enables free partnering to validate use cases, understand
                demand behavior, and refine matching accuracy.
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading text-lg mb-2 text-gold-primary">
                Alpha Phase
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                A minimal platform fee is introduced with a countdown-based
                matching system that encourages faster partner formation and
                commitment.
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading text-lg mb-2 text-gold-primary">
                Beta Phase
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Users can pay higher fees for priority matching, gaining faster
                access to high-quality partners and time-sensitive opportunities.
              </p>
            </div>

            <div className="border border-dark-card bg-dark-section rounded-2xl p-6">
              <h3 className="font-heading text-lg mb-2 text-gold-primary">
                Gamma Phase
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Subscription plans (monthly and yearly) are introduced for power
                users, businesses, and frequent collaborators, enabling
                predictable recurring revenue.
              </p>
            </div>

          </div>
        </section>

      </div>
    </main>
  );
}
