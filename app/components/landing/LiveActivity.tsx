"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ActivityItem = {
  id: number;
  text: string;
  emoji: string;
  time: string;
};

const liveActivities: ActivityItem[] = [
  { id: 1, text: "Education Group Completed — ₹12,000 saved", emoji: "🎓", time: "2m ago" },
  { id: 2, text: "5 Members Joined Travel Group", emoji: "👥", time: "5m ago" },
  { id: 3, text: "Netflix Group Ready — ₹150/month each", emoji: "🎬", time: "8m ago" },
  { id: 4, text: "Gym Partnership Formed in Guntur", emoji: "💪", time: "12m ago" },
  { id: 5, text: "Cult Fit Group reached 3/4 members", emoji: "🏋️", time: "15m ago" },
  { id: 6, text: "Villa Stay Split — ₹4,000 per person", emoji: "🏡", time: "20m ago" },
];

export default function LiveActivity() {
  const [currentActivity, setCurrentActivity] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentActivity((prev) => (prev + 1) % liveActivities.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-heading text-lg sm:text-xl text-white mb-4 text-center">
          Live Activity
        </h2>
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
          
          {/* Dots indicator */}
          <div className="flex justify-center gap-1.5 mt-3">
            {liveActivities.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentActivity(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  i === currentActivity ? "bg-[#D4AF37] w-3" : "bg-gray-600 hover:bg-gray-500"
                }`}
                aria-label={`View activity ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}