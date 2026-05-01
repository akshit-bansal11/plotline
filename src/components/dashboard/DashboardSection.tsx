// File: src/components/dashboard/DashboardSection.tsx
// Purpose: Dashboard view presenting user metrics, recent activity, and library overview

"use client";

// ─── Icons
import { Clock, List, Star, Zap } from "lucide-react";
import Image from "next/image";
// ─── React & Next
import { useMemo } from "react";

// ─── Internal — hooks
import { useAuth } from "@/context/AuthContext";
import { useDashboardStats } from "@/hooks/useDashboardStats";

// ─── Internal — types
import type { EntryDoc, EntryMediaType, EntryStatus } from "@/context/DataContext";
import { isCompletionStatus } from "@/types/log-entry";

// ─── Internal — utils
import { cn, entryStatusLabels } from "@/utils";
import { contentTypeLabels, metricLabels } from "@/utils/dashboard";
import { formatISODate } from "@/utils/date";

// ─── Internal — components
import { Hero } from "../library/Hero";
import { GlassCard } from "../ui/GlassCard";

// ─────────────────────────────────────────────────────────────────────────────

interface DashboardSectionProps {
  entries: EntryDoc[];
  status: string;
  error: string | null;
  onRetry: () => void;
  onSelectEntry: (entry: EntryDoc) => void;
}

/**
 * Renders the primary dashboard view with statistics and activity.
 */
export function DashboardSection({
  entries,
  status,
  error,
  onRetry,
  onSelectEntry,
}: DashboardSectionProps) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const { metricsByType, heroStats, recentByType } = useDashboardStats(entries);

  const username = user?.displayName || user?.email?.split("@")[0] || "Traveler";

  return (
    <div className="flex flex-col gap-10 pb-20 animate-in fade-in duration-500">
      {/* Hero Section */}
      <Hero username={username} stats={heroStats} />

      {/* Metrics Grid */}
      <section className="px-4 md:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Library Statistics
          </h2>
          {!uid && <span className="text-xs text-zinc-500">Sign in to sync your library</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => (
            <GlassCard
              key={type}
              className="p-5 border-white/5 hover:border-white/10 transition-colors"
              hoverEffect
            >
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">
                {contentTypeLabels[type]}
              </div>
              <div className="space-y-4">
                {metricLabels.map(({ key, label }) => (
                  <div key={key} className="flex items-baseline justify-between">
                    <span className="text-[11px] text-zinc-500 font-medium">{label}</span>
                    <span className="text-2xl font-bold text-zinc-100 tabular-nums">
                      {metricsByType[type][key].toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="px-4 md:px-8 space-y-6">
        <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Recent Activity
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {(Object.keys(contentTypeLabels) as EntryMediaType[]).map((type) => {
            const items = recentByType[type].slice(0, 5);
            if (uid && items.length === 0) return null;

            return (
              <GlassCard key={type} className="p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-300">{contentTypeLabels[type]}</h3>
                  <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-tighter">
                    Latest Entries
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((entry) => (
                    <ActivityRow
                      key={entry.id}
                      entry={entry}
                      onSelect={() => onSelectEntry(entry)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="py-8 text-center text-zinc-600 text-xs italic">
                      No activity tracked yet.
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components
function ActivityRow({ entry, onSelect }: { entry: EntryDoc; onSelect: () => void }) {
  return (
    <div
      className="group flex items-center gap-3 p-2 rounded-xl bg-zinc-900/40 border border-transparent hover:border-zinc-800 hover:bg-zinc-800/40 transition-all cursor-pointer"
      onClick={onSelect}
    >
      <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
        {entry.image && (
          <Image
            src={entry.image}
            alt=""
            width={40}
            height={56}
            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all"
          />
        )}
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-200 truncate">{entry.title}</span>
          <StatusBadge status={entry.status} />
        </div>
        <div className="text-[10px] text-zinc-500 mt-0.5 font-medium uppercase tracking-wide">
          {entry.completedAtMs ? `Completed ${formatISODate(entry.completedAtMs)}` : "In Progress"}
        </div>
      </div>
      {entry.userRating && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-800/80 text-[11px] font-bold text-zinc-200">
          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
          {entry.userRating}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: EntryStatus }) {
  const isDone = isCompletionStatus(status);
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border",
        isDone
          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          : "bg-blue-500/10 border-blue-500/20 text-blue-400",
      )}
    >
      {entryStatusLabels[status] || "Unknown"}
    </span>
  );
}
