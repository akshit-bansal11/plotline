"use client";

import { motion } from "motion/react";
import { Plus, List } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface HeroProps {
    username?: string;
    stats?: {
        movies: number;
        series: number;
        anime: number;
        games: number;
    };
}

export function Hero({ username = "Traveler", stats = { movies: 0, series: 0, anime: 0, games: 0 } }: HeroProps) {
    return (
        <div className="relative w-full overflow-hidden pt-32 pb-12">
            {/* Background Gradient/Noise */}
            <div className="absolute inset-0 bg-neutral-950">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-neutral-900/30 blur-[120px] rounded-full pointer-events-none" />
            </div>

            <div className="relative z-10 container mx-auto px-4 md:px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-8"
                >
                    <div className="space-y-4">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                            Welcome back, <span className="text-neutral-400">{username}</span>.
                        </h1>
                        <p className="text-lg text-neutral-400 max-w-xl">
                            Track what you&apos;ve watched, manage your backlog, and build your ultimate collection.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                        <GlassCard className="flex items-center gap-2 px-6 py-3 cursor-pointer hover:bg-white/5 transition-colors w-full sm:w-auto justify-center sm:justify-start" hoverEffect>
                            <Plus size={20} className="text-white" />
                            <span className="font-medium text-white">Log Entry</span>
                        </GlassCard>
                        <GlassCard className="flex items-center gap-2 px-6 py-3 cursor-pointer hover:bg-white/5 transition-colors w-full sm:w-auto justify-center sm:justify-start" hoverEffect>
                            <List size={20} className="text-white" />
                            <span className="font-medium text-white">My Lists</span>
                        </GlassCard>
                    </div>
                </motion.div>

                {/* Stats Grid */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12"
                >
                    <StatCard label="Movies Watched" value={stats.movies} />
                    <StatCard label="Episodes Watched" value={stats.series} />
                    <StatCard label="Anime Completed" value={stats.anime} />
                    <StatCard label="Games Beaten" value={stats.games} />
                </motion.div>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: number }) {
    return (
        <GlassCard className="flex flex-col gap-1 p-6 transition-transform hover:-translate-y-1" hoverEffect>
            <span className="text-3xl font-bold text-white">{value.toLocaleString()}</span>
            <span className="text-sm font-medium text-neutral-500">{label}</span>
        </GlassCard>
    )
}
