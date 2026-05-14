"use client";

import Image from "next/image";

export default function TeamPage() {
  return (
    <main className="min-h-screen bg-dark-section text-white px-6 py-24">
      <div className="max-w-6xl mx-auto">

        {/* ================= TITLE ================= */}
        <section className="text-center mb-28">
          <h1 className="font-heading text-3xl sm:text-4xl mb-4">
            The People Building <span className="text-gold-primary">PartnerSync</span>
          </h1>
          <p className="text-text-muted text-sm max-w-2xl mx-auto">
            A focused team driven by purpose, execution, and the belief that
            collaboration can unlock real-world value at scale.
          </p>
        </section>

        {/* ================= FOUNDER ================= */}
        <section className="flex flex-col md:flex-row items-center gap-14 mb-36">

          {/* IMAGE */}
          <div className="relative">
            <div
              className="w-52 h-52 rounded-full overflow-hidden
                         border-2 border-gold-primary
                         shadow-[0_0_50px_rgba(212,175,55,0.45)]"
            >
              <Image
                src="/placeholder-founder.jpg" // 🔁 replace later
                alt="Founder"
                width={220}
                height={220}
                className="object-cover"
              />
            </div>
          </div>

          {/* INFO */}
          <div className="max-w-xl text-center md:text-left">
            <p className="uppercase tracking-widest text-xs text-text-muted mb-3">
              Founder
            </p>

            <h2 className="font-heading text-2xl mb-1">
              Satyamanoj Biyyapu
            </h2>

            <p className="text-gold-primary font-body mb-6">
              Founder & Product Vision
            </p>

            <p className="text-text-body text-sm leading-relaxed mb-6">
              Satyamanoj is building PartnerSync with a long-term vision to
              redefine how people collaborate to save money, unlock access,
              and create shared value. With a strong product-first mindset,
              he focuses on solving everyday inefficiencies through trust-based
              matching and practical execution.
            </p>

            <p className="text-text-body text-sm leading-relaxed mb-8">
              PartnerSync is not a marketplace — it is a system designed to
              align people with similar intent, enabling smarter decisions,
              lower costs, and meaningful participation in shared opportunities.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 items-center md:items-start">
              <a
                href="mailto:syncpartnerduo@gmail.com"
                className="px-6 py-2 rounded-full bg-gold-primary
                           text-black font-medium
                           hover:bg-gold-soft transition"
              >
                Contact Founder
              </a>

              <span className="text-text-muted text-sm">
                syncpartnerduo@gmail.com
              </span>
            </div>
          </div>
        </section>

        {/* ================= TEAM ================= */}
        <section>
          <h3 className="font-heading text-2xl text-center mb-16">
            Core <span className="text-gold-primary">Contributors</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">

            {[
              "Bollu Aditya",
              "Jeethukumar",
              "Abhi Gokavarapu",
              "Jyothi Suggula",
              "Bobba Jaswanth",
              "Dasari Srikar",
            ].map((name, i) => (
              <div
                key={i}
                className="group relative rounded-2xl p-8
                           bg-black/40 border border-dark-card
                           hover:border-gold-primary
                           transition-all duration-300
                           hover:shadow-[0_0_45px_rgba(212,175,55,0.35)]"
              >
                {/* IMAGE */}
                <div
                  className="w-24 h-24 mx-auto mb-5 rounded-full overflow-hidden
                             border border-gold-primary/40"
                >
                  <Image
                    src={`/team/${i + 1}.jpg`} // 🔁 replace later
                    alt={name}
                    width={96}
                    height={96}
                    className="object-cover"
                  />
                </div>

                {/* NAME */}
                <h4 className="font-heading text-lg text-center mb-2">
                  {name}
                </h4>

                {/* ROLE */}
                <p className="text-text-muted text-xs text-center mb-5">
                  Core Contributor · PartnerSync
                </p>

                {/* LINK PLACEHOLDER */}
                <div className="text-center">
                  <span
                    className="inline-flex items-center gap-1 text-sm
                               text-text-muted
                               group-hover:text-gold-primary transition"
                  >
                    View Profile →
                  </span>
                </div>

                {/* GOLD GLOW */}
                <span
                  className="pointer-events-none absolute inset-0 rounded-2xl
                             opacity-0 group-hover:opacity-100
                             shadow-[0_0_70px_rgba(212,175,55,0.25)]
                             transition"
                />
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
