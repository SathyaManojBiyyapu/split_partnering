"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import CircularProgress from "@/app/components/ui/CircularProgress";
import { getCompatibilityConfig } from "@/app/data/compatibilityConfig";

interface CompatibilityInsightProps {
  slug: string;
  categoryTitle: string;
  ctaHref: string;
}

/**
 * Premium, category-specific "Compatibility / Matching Insight" section.
 * Replaces the old generic How It Works / Success Stories / Ready to Start
 * Saving blocks with a visual explanation of HOW PartnerSync matches people
 * for this specific category: a circular compatibility score, headline,
 * description, illustration, and 4 weighted matching factors with animated
 * progress bars.
 */
export default function CompatibilityInsight({ slug, categoryTitle, ctaHref }: CompatibilityInsightProps) {
  const config = getCompatibilityConfig(slug);
  const { accent, illustrationIcon: Illustration } = config;
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section className="px-4 pb-16" aria-label={`${categoryTitle} compatibility matching insight`}>
      <div className="max-w-5xl mx-auto" ref={sectionRef}>
        {/* Section eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1.5 rounded-full border"
            style={{
              color: accent.primary,
              borderColor: `${accent.primary}40`,
              background: `${accent.primary}12`,
            }}
          >
            {config.ctaLabel}
          </span>
        </motion.div>

        {/* Main compatibility card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative rounded-3xl overflow-hidden p-6 sm:p-10"
          style={{
            background: "linear-gradient(145deg, rgba(250,248,242,0.06), rgba(20,18,14,0.5))",
            border: `1px solid ${accent.primary}22`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 60px ${accent.glow}`,
          }}
        >
          {/* Ambient glow blobs */}
          <div
            className="absolute -top-24 -right-24 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${accent.glow}, transparent 70%)`, filter: "blur(40px)" }}
          />
          <div
            className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${accent.glow}, transparent 70%)`, filter: "blur(40px)" }}
          />

          <div className="relative grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-8 md:gap-10 items-center">
            {/* LEFT: circular compatibility score */}
            <div className="flex justify-center md:justify-start">
              <CircularProgress score={config.score} primaryColor={accent.primary} secondaryColor={accent.secondary} />
            </div>

            {/* CENTER: label, headline, description */}
            <div className="text-center md:text-left">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2"
                style={{ color: accent.primary }}
              >
                Compatibility Score
              </p>
              <h2 className="font-heading text-2xl sm:text-3xl md:text-4xl text-white leading-tight mb-3">
                {config.headlineLines.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed max-w-md mx-auto md:mx-0">
                {config.description}
              </p>
            </div>

            {/* RIGHT: category illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
              animate={isInView ? { opacity: 1, scale: 1, rotate: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="hidden md:flex items-center justify-center w-28 h-28 rounded-3xl flex-shrink-0"
              style={{
                background: `linear-gradient(145deg, ${accent.primary}22, ${accent.secondary}0d)`,
                border: `1px solid ${accent.primary}33`,
              }}
            >
              <Illustration className="w-14 h-14" style={{ color: accent.primary }} strokeWidth={1.5} />
            </motion.div>
          </div>

          {/* Mobile illustration (shown below headline on small screens) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex md:hidden items-center justify-center w-20 h-20 rounded-2xl mx-auto mt-6"
            style={{
              background: `linear-gradient(145deg, ${accent.primary}22, ${accent.secondary}0d)`,
              border: `1px solid ${accent.primary}33`,
            }}
          >
            <Illustration className="w-10 h-10" style={{ color: accent.primary }} strokeWidth={1.5} />
          </motion.div>

          {/* Divider */}
          <div className="my-8 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent.primary}30, transparent)` }} />

          {/* BOTTOM: 4 matching factors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
            {config.factors.map((factor, i) => {
              const FactorIcon = factor.icon;
              return (
                <motion.div
                  key={factor.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${accent.primary}18`, border: `1px solid ${accent.primary}30` }}
                      >
                        <FactorIcon className="w-4 h-4" style={{ color: accent.primary }} />
                      </div>
                      <span className="text-sm font-medium text-white">{factor.label}</span>
                    </div>
                    <span className="text-sm font-bold" style={{ color: accent.primary }}>
                      {factor.weight}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${accent.primary}, ${accent.secondary})` }}
                      initial={{ width: "0%" }}
                      animate={isInView ? { width: `${factor.weight}%` } : { width: "0%" }}
                      transition={{ duration: 0.9, delay: 0.4 + i * 0.1, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-9 flex justify-center md:justify-start"
          >
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-transform hover:scale-[1.03]"
              style={{
                background: `linear-gradient(135deg, ${accent.primary}, ${accent.secondary})`,
                color: "#0a0a0a",
                boxShadow: `0 8px 24px ${accent.glow}`,
              }}
            >
              {config.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

