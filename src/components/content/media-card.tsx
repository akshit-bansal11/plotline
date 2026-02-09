"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

interface MediaCardProps {
    id?: string | number;
    title: string;
    image: string;
    year?: string;
    type?: string;
    className?: string;
    aspectRatio?: "poster" | "video";
    href?: string;
    rating?: number; // 0-10 or 0-5
    status?: "watching" | "completed" | "plan_to_watch" | "dropped";
}

export function MediaCard({
    id,
    title,
    image,
    year,
    type,
    className,
    aspectRatio = "poster",
    href,
    rating,
    status,
}: MediaCardProps) {
    const linkHref = href || (type && id ? `/${type === "series" ? "tv" : "movie"}/${id}` : "#");

    // Status colors/badges
    const getStatusColor = (s?: string) => {
        switch (s) {
            case 'watching': return 'bg-green-500/20 text-green-400 border-green-500/20';
            case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
            case 'plan_to_watch': return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/20';
            default: return 'hidden';
        }
    };

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className={cn("group relative", className)}
        >
            <Link href={linkHref} className="block outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl">
                <GlassCard
                    className={cn(
                        "relative overflow-hidden p-0 border-white/5 bg-neutral-900/20",
                        aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-video"
                    )}
                    hoverEffect
                >
                    <Image
                        src={image}
                        alt={title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Status Badge (Top Right) */}
                    {status && (
                        <div className="absolute top-3 right-3 z-10">
                            <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border backdrop-blur-md", getStatusColor(status))}>
                                {status.replace(/_/g, " ")}
                            </span>
                        </div>
                    )}

                    {/* Rating (Top Left) */}
                    {rating && (
                        <div className="absolute top-3 left-3 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-neutral-950/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white">
                                {rating}
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-2 transition-transform duration-300 group-hover:translate-y-0 opacity-0 group-hover:opacity-100">
                        <h3 className="font-medium text-white truncate text-shadow-sm">{title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-neutral-300">
                            {year && <span>{year}</span>}
                            {type && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-neutral-500" />
                                    <span className="capitalize">{type}</span>
                                </>
                            )}
                        </div>
                    </div>
                </GlassCard>
            </Link>
        </motion.div>
    );
}
