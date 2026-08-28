"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

interface CircularProgressProps {
  score: number; // 0-100
  primaryColor: string;
  secondaryColor: string;
  size?: number;
  strokeWidth?: number;
  label?: string; // small caption under the % e.g. "COMPATIBLE"
}

/**
 * Animated circular compatibility score ring.
 * Draws its stroke and counts the percentage up when it scrolls into view.
 */
export default function CircularProgress({
  score,
  primaryColor,
  secondaryColor,
  size = 168,
  strokeWidth = 10,
  label = "COMPATIBLE",
}: CircularProgressProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const [displayScore, setDisplayScore] = useState(0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const gradientId = `compat-ring-${primaryColor.replace("#", "")}`;

  useEffect(() => {
    if (!isInView) return;
    let frame: number;
    const duration = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, score]);

  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div ref={ref} className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} />
            <stop offset="100%" stopColor={secondaryColor} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.1s linear",
            filter: `drop-shadow(0 0 8px ${primaryColor}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, y: 6 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="text-3xl sm:text-4xl font-bold text-white leading-none"
        >
          {displayScore}%
        </motion.span>
        <span
          className="mt-1.5 text-[10px] font-bold tracking-[0.15em] uppercase"
          style={{ color: primaryColor }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
