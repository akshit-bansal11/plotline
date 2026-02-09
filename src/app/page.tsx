import { Hero } from "@/components/content/hero";
import { MediaSection } from "@/components/content/media-section";
import { MediaCard } from "@/components/content/media-card";
import { GlassCard } from "@/components/ui/glass-card";
import { Plus } from "lucide-react";
import Image from "next/image";

// Mock Data for User's Library
const STATS = {
  movies: 142,
  series: 28,
  anime: 56,
  games: 12
};

const WATCHING_NOW = [
  { id: 1, title: "Shogun", image: "https://image.tmdb.org/t/p/w500/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg", year: "2024", type: "series", status: "watching" as const, rating: 9.2 },
  { id: 2, title: "Frieren: Beyond Journey's End", image: "https://image.tmdb.org/t/p/w500/qqkYoTtZZoF43G45faXl19U0r9r.jpg", year: "2023", type: "anime", status: "watching" as const, rating: 9.5 },
  { id: 3, title: "Fallout", image: "https://image.tmdb.org/t/p/w500/AnsSKR9LuK0cB9siEiHO7oZcmsd.jpg", year: "2024", type: "series", status: "watching" as const, rating: 8.8 },
];

const PLAN_TO_WATCH = [
  { id: 4, title: "Dune: Part Two", image: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg", year: "2024", type: "movie", status: "plan_to_watch" as const },
  { id: 5, title: "Civil War", image: "https://image.tmdb.org/t/p/w500/sh7Rg8Er3tFcN9BpKIPOMvALgZd.jpg", year: "2024", type: "movie", status: "plan_to_watch" as const },
  { id: 6, title: "3 Body Problem", image: "https://image.tmdb.org/t/p/w500/1MHu4btke4WAbpcc4YMc5h9gST.jpg", year: "2024", type: "series", status: "plan_to_watch" as const },
];

const FAVORITES = [
  { id: 7, title: "Interstellar", image: "https://image.tmdb.org/t/p/w500/gEU2QniL6C8zt747TxIjeskOdBS.jpg", year: "2014", type: "movie", rating: 10, status: "completed" as const },
  { id: 8, title: "Blade Runner 2049", image: "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", year: "2017", type: "movie", rating: 9.5, status: "completed" as const },
  { id: 9, title: "The Dark Knight", image: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg", year: "2008", type: "movie", rating: 10, status: "completed" as const },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8 pb-20">
      <Hero username="Loq" stats={STATS} />

      <div className="space-y-4">
        {/* Continue Watching Section */}
        <section className="container mx-auto px-4 md:px-6 py-4">
          <h2 className="text-xl font-semibold text-white mb-6">Currently Watching</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WATCHING_NOW.map(item => (
              <GlassCard key={item.id} className="flex gap-4 p-4 items-center" hoverEffect>
                <div className="relative w-16 h-24 shrink-0 rounded-lg overflow-hidden">
                  <Image src={item.image} alt={item.title} fill className="object-cover w-full h-full" sizes="64px" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{item.title}</h3>
                  <div className="text-xs text-neutral-400 mt-1">{item.type} • {item.year}</div>
                  {/* Progress bar mock */}
                  <div className="mt-3 w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white/50 w-[60%] rounded-full" />
                  </div>
                  <div className="mt-1 text-xs text-neutral-500 text-right">Episode 4/8</div>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <MediaSection title="Plan to Watch" href="/lists/plan-to-watch">
          {PLAN_TO_WATCH.map((item) => (
            <div key={item.id} className="min-w-[160px] md:min-w-[200px] snap-center">
              <MediaCard {...item} />
            </div>
          ))}
        </MediaSection>

        <MediaSection title="Favorites" href="/lists/favorites">
          {FAVORITES.map((item) => (
            <div key={item.id} className="min-w-[160px] md:min-w-[200px] snap-center">
              <MediaCard {...item} />
            </div>
          ))}
        </MediaSection>

        {/* Custom Lists Section */}
        <section className="container mx-auto px-4 md:px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Your Lists</h2>
            <button className="flex items-center gap-1 text-sm text-neutral-400 hover:text-white transition-colors">
              <Plus size={16} />
              <span>Create New</span>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ListCard title="Sci-Fi Masterpieces" count={12} />
            <ListCard title="Sunday Cartoons" count={45} />
            <ListCard title="Gaming Backlog" count={8} />
            <GlassCard className="flex flex-col items-center justify-center p-8 border-dashed border-neutral-800 bg-transparent hover:bg-neutral-900/50 cursor-pointer text-neutral-500 hover:text-white transition-colors">
              <Plus size={24} className="mb-2" />
              <span className="font-medium">New List</span>
            </GlassCard>
          </div>
        </section>
      </div>
    </div>
  );
}

function ListCard({ title, count }: { title: string; count: number }) {
  return (
    <GlassCard className="p-6 cursor-pointer group" hoverEffect>
      <h3 className="font-semibold text-lg text-white group-hover:text-blue-200 transition-colors">{title}</h3>
      <p className="text-sm text-neutral-500 mt-1">{count} items</p>
    </GlassCard>
  )
}
