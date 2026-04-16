"use client";

import { motion } from "motion/react";

interface HeroProps {
  username?: string;
  stats?: {
    movies: number;
    series: number;
    anime: number;
    manga: number;
    games: number;
  };
}

export function Hero({
  username = "Traveler",
  stats = { movies: 0, series: 0, anime: 0, manga: 0, games: 0 },
}: HeroProps) {
  const totalTracked = stats.movies + stats.series + stats.anime + stats.manga + stats.games;

  return (
    <div className="relative w-full overflow-hidden pt-22">
      <div className="relative z-10 w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-8"
        >
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-geoma-light tracking-wide text-white">
              Welcome back, <span className="text-neutral-400 font-geoma">{username}</span>
            </h1>
            <p className="text-lg text-neutral-400 max-w-xl">
              Track what you&apos;ve watched, manage your backlog, and build your ultimate
              collection.
            </p>
            <p className="text-sm text-neutral-500">
              {totalTracked.toLocaleString()} total tracked entries
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
