"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn } from "@/lib/utils";

interface MediaCardProps {
    id?: string | number;
    title: string;
    image: string | null;
    year?: string;
    type?: string;
    className?: string;
    aspectRatio?: "poster" | "video";
    userRating?: number | null;
    imdbRating?: number | null;
    status?: "watching" | "completed" | "plan_to_watch" | "dropped";
    onClick?: () => void;
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
}

export function MediaCard({
    title,
    image,
    year,
    type,
    className,
    aspectRatio = "poster",
    userRating,
    imdbRating,
    status,
    onClick,
    onView,
    onEdit,
    onDelete,
    showActions = false,
}: MediaCardProps) {
    const getStatusColor = (s?: string) => {
        switch (s) {
            case 'watching': return 'bg-green-500/20 text-green-400 border-green-500/20';
            case 'completed': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
            case 'plan_to_watch': return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/20';
            default: return 'hidden';
        }
    };

    const displayRating = typeof userRating === "number" ? userRating : typeof imdbRating === "number" ? imdbRating : null;
    const displayRatingText =
        displayRating !== null && Number.isFinite(displayRating)
            ? Number.isInteger(displayRating)
                ? String(displayRating)
                : displayRating.toFixed(1)
            : "";

    const content = (
        <GlassCard
            className={cn(
                "relative overflow-hidden p-0 border-white/5 bg-neutral-900/20",
                aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-video"
            )}
            hoverEffect
        >
            {image ? (
                <Image
                    src={image}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                />
            ) : (
                <div className="absolute inset-0 bg-neutral-800/60" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {status && (
                <div className="absolute top-3 right-3 z-10">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border backdrop-blur-md", getStatusColor(status))}>
                        {status.replace(/_/g, " ")}
                    </span>
                </div>
            )}

            {displayRating !== null ? (
                <div className="absolute top-3 left-3 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-xs font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                        {displayRatingText}
                    </div>
                </div>
            ) : null}

            <div className="absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 translate-y-0 opacity-100 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
                <h3 className="font-medium text-white line-clamp-2 text-shadow-sm">{title}</h3>
                <div className="flex items-center gap-2 mt-1 text-xs text-neutral-300">
                    {year && <span>{year}</span>}
                    {type && (
                        <>
                            <span className="w-1 h-1 rounded-full bg-neutral-500" />
                            <span className="capitalize">{type}</span>
                        </>
                    )}
                </div>
                {showActions && (
                    <div className="flex gap-2 mt-2">
                        {onView && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onView();
                                }}
                                className="px-2 py-1 text-xs rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                View
                            </button>
                        )}
                        {onEdit && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                className="px-2 py-1 text-xs rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
                            >
                                Edit
                            </button>
                        )}
                        {onDelete && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="px-2 py-1 text-xs rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>
        </GlassCard>
    );

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className={cn("group relative", className)}
        >
            {onClick ? (
                <div
                    onClick={onClick}
                    aria-label={title}
                    role="button"
                    tabIndex={0}
                    className="block w-full rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-neutral-100/40"
                >
                    {content}
                </div>
            ) : (
                <div className="block w-full rounded-2xl">{content}</div>
            )}
        </motion.div>
    );
}
