"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto pb-mobile-cta">
      <Skeleton className="h-10 w-48 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      {[1, 2].map((i) => (
        <Skeleton key={i} className="h-48 rounded-xl mb-4" />
      ))}
    </div>
  );
}