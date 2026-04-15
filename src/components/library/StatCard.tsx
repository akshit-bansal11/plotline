"use client";

import { GlassCard } from "@/components/ui/GlassCard";

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <GlassCard
      className="flex flex-col gap-1 p-6 transition-transform hover:-translate-y-1"
      hoverEffect
    >
      <span className="text-3xl font-bold text-white">
        {value.toLocaleString()}
      </span>
      <span className="text-sm font-medium text-neutral-500">{label}</span>
    </GlassCard>
  );
}
