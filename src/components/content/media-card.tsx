"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ChevronDown, Star, Link } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { cn, entryStatusLabels } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { useData } from "@/context/data-context";
import { db } from "@/lib/firebase";
import { getOTTAvailability } from "@/lib/ott";
import { DescriptionErrorWrapper } from "@/components/ui/description-error-wrapper";
import { MAX_DESCRIPTION_LENGTH_MANUAL } from "@/lib/validation";
import type { EntryStatus } from "@/context/data-context";

const statusLabels: Record<EntryStatus, string> = entryStatusLabels;

interface MediaCardProps {
    id?: string | number;
    title: string;
    description?: string;
    image: string | null;
    year?: string;
    type?: string;
    className?: string;
    aspectRatio?: "poster" | "video";
    userRating?: number | null;
    imdbRating?: number | null;
    status?: EntryStatus;
    relations?: { targetId: string; type: string; createdAtMs: number }[];
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
}

export function MediaCard({
    id,
    title,
    description,
    image,
    year,
    type,
    className,
    aspectRatio = "poster",
    userRating,
    status,
    relations,
    onClick,
    onEdit,
    onDelete,
    showActions = false,
}: MediaCardProps) {
    const { user } = useAuth();
    const uid = user?.uid || null;
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement | null>(null);
    const [localRating, setLocalRating] = useState<number | null>(
        typeof userRating === "number" && Number.isFinite(userRating) ? userRating : null
    );
    const [isRatingMenuOpen, setIsRatingMenuOpen] = useState(false);
    const [hoverRating, setHoverRating] = useState<number | null>(null);
    const [isRatingUpdating, setIsRatingUpdating] = useState(false);
    const [isRelationsOpen, setIsRelationsOpen] = useState(false);
    const relationsMenuRef = useRef<HTMLDivElement | null>(null);

    const { selectedCountry, entries } = useData();
    const ottProviders = getOTTAvailability(title, selectedCountry, type);

    useEffect(() => {
        if (!isRelationsOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (relationsMenuRef.current && !relationsMenuRef.current.contains(event.target as Node)) {
                setIsRelationsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isRelationsOpen]);

    useEffect(() => {
        if (!isStatusOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isStatusOpen]);

    useEffect(() => {
        const next =
            typeof userRating === "number" && Number.isFinite(userRating) ? userRating : null;
        setLocalRating(next);
    }, [userRating]);

    const statusOptions: EntryStatus[] = ["watching", "completed", "plan_to_watch", "on_hold", "dropped", "unspecified"];

    const getStatusBadgeClass = (s: EntryStatus) => {
        switch (s) {
            case "completed":
                return "border-emerald-500/50 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900/80";
            case "watching":
                return "border-blue-500/50 bg-blue-950/80 text-blue-400 hover:bg-blue-900/80";
            case "plan_to_watch":
                return "border-neutral-500/50 bg-neutral-950/80 text-neutral-400 hover:bg-neutral-900/80";
            case "on_hold":
                return "border-yellow-500/50 bg-yellow-950/80 text-yellow-400 hover:bg-yellow-900/80";
            case "dropped":
                return "border-red-500/50 bg-red-950/80 text-red-400 hover:bg-red-900/80";
            default:
                return "border-neutral-500/30 bg-neutral-950/80 text-neutral-400 hover:bg-neutral-900/80";
        }
    };

    const handleStatusChange = async (next: EntryStatus) => {
        if (!uid || !id) return;
        if (status === next) {
            setIsStatusOpen(false);
            return;
        }
        setIsStatusUpdating(true);
        try {
            await updateDoc(doc(db, "users", uid, "entries", String(id)), {
                status: next,
                updatedAt: serverTimestamp(),
            });
            setIsStatusOpen(false);
        } finally {
            setIsStatusUpdating(false);
        }
    };

    const displayRating = localRating;
    const displayRatingText =
        displayRating !== null && Number.isFinite(displayRating)
            ? Number.isInteger(displayRating)
                ? String(displayRating)
                : displayRating.toFixed(1)
            : "";

    const getRatingAccent = (value: number) => {
        if (value >= 9) return "border-emerald-400/50 bg-emerald-950/80 text-emerald-200";
        if (value >= 7) return "border-yellow-400/50 bg-yellow-950/80 text-yellow-200";
        if (value >= 4) return "border-red-400/50 bg-red-950/80 text-red-200";
        return "border-neutral-400/40 bg-neutral-950/80 text-neutral-200";
    };

    const handleRatingChange = async (value: number) => {
        if (!uid || !id) return;
        if (value < 1 || value > 10) return;
        setIsRatingUpdating(true);
        setLocalRating(value);
        setHoverRating(null);
        try {
            await updateDoc(doc(db, "users", uid, "entries", String(id)), {
                userRating: value,
                updatedAt: serverTimestamp(),
            });
        } finally {
            setIsRatingUpdating(false);
            setIsRatingMenuOpen(false);
        }
    };

    const isInvalid = !!description && description.length > MAX_DESCRIPTION_LENGTH_MANUAL;

    const actionButtons = showActions ? (
        <div className="flex gap-2 pointer-events-auto">
            {onEdit && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    className="px-2 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-lg"
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
                    className="px-2 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg font-medium"
                >
                    Delete
                </button>
            )}
        </div>
    ) : null;

    const content = (
        <GlassCard
            className={cn(
                "relative overflow-hidden p-0 border-white/5 bg-neutral-900/20",
                aspectRatio === "poster" ? "aspect-[5/7]" : "aspect-video"
            )}
            hoverEffect
        >
            <DescriptionErrorWrapper
                isInvalid={isInvalid}
                className="absolute inset-0"
                actions={
                    isInvalid && showActions ? (
                        <div className="absolute inset-x-0 bottom-4 flex justify-center z-30 pointer-events-none">
                            {actionButtons}
                        </div>
                    ) : null
                }
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

                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/95 via-neutral-950/50 to-transparent opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100" />

                {status ? (
                    <div
                        className="absolute top-3 right-3 z-10"
                        ref={statusMenuRef}
                        onMouseEnter={() => setIsStatusOpen(true)}
                        onMouseLeave={() => setIsStatusOpen(false)}
                    >
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsStatusOpen((prev) => !prev);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            disabled={isStatusUpdating}
                            className={cn(
                                "group/status flex items-center gap-2 rounded-full border backdrop-blur-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 media-card-status-button",
                                getStatusBadgeClass(status),
                                isStatusUpdating ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                            )}
                            aria-haspopup="listbox"
                            aria-expanded={isStatusOpen}
                            aria-label="Change status"
                        >
                            <span>{isStatusUpdating ? "Updating..." : statusLabels[status]}</span>
                            <ChevronDown
                                size={11}
                                className={cn(
                                    "transition-transform duration-300 ease-in-out text-current/70 group-hover/status:text-current",
                                    isStatusOpen ? "rotate-180" : ""
                                )}
                                suppressHydrationWarning
                            />
                        </button>
                        <AnimatePresence>
                            {isStatusOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 mt-2 w-40 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl p-2 shadow-xl"
                                >
                                    {statusOptions.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                handleStatusChange(option);
                                            }}
                                            className={cn(
                                                "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
                                                option === status
                                                    ? "bg-white/10 text-white"
                                                    : "text-neutral-300 hover:bg-white/5"
                                            )}
                                        >
                                            <span>{statusLabels[option]}</span>
                                            {option === status && (
                                                <div className="h-1 w-1 rounded-full bg-current" />
                                            )}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ) : null}

                <div
                    className="absolute top-3 left-3 z-10 transition-opacity duration-300"
                    onMouseEnter={() => setIsRatingMenuOpen(true)}
                    onMouseLeave={() => {
                        if (!isRatingUpdating) {
                            setIsRatingMenuOpen(false);
                            setHoverRating(null);
                        }
                    }}
                >
                    <div
                        className={cn(
                            "flex items-center justify-center w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border text-xs font-bold shadow-[0_4px_12px_rgba(0,0,0,0.5)] ring-1 ring-white/5 transition-colors media-card-rating-badge",
                            displayRating !== null ? getRatingAccent(displayRating) : "border-neutral-400/40 text-neutral-200"
                        )}
                    >
                        {displayRating !== null ? (
                            displayRatingText
                        ) : (
                            <Star size={11} className="text-neutral-300" suppressHydrationWarning />
                        )}
                    </div>
                    <AnimatePresence>
                        {isRatingMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                                transition={{ duration: 0.15 }}
                                className="mt-2 rounded-xl border border-white/10 bg-neutral-950/95 px-3 py-2 shadow-xl backdrop-blur-xl media-card-rating-menu"
                            >
                                <div className="flex items-center gap-1">
                                    {Array.from({ length: 10 }, (_, index) => {
                                        const value = index + 1;
                                        const current = hoverRating ?? displayRating ?? 0;
                                        const isActive = current >= value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void handleRatingChange(value);
                                                }}
                                                onMouseEnter={() => setHoverRating(value)}
                                                className="flex h-5 w-5 items-center justify-center transition-transform duration-150 hover:scale-110 media-card-rating-option"
                                                aria-label={`Set rating to ${value}`}
                                            >
                                                <Star
                                                    size={13}
                                                    className={cn(
                                                        "transition-colors",
                                                        isActive
                                                            ? "text-yellow-300"
                                                            : "text-neutral-600"
                                                    )}
                                                    suppressHydrationWarning
                                                />
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>



                {/* OTT Badges */}
                {ottProviders.length > 0 && (
                    <div className="absolute bottom-20 left-3 flex flex-col items-center mb-5 gap-2 z-10 opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100">
                        {ottProviders.map((provider) => (
                            <div
                                key={provider.name}
                                className="relative h-10 w-10 overflow-hidden rounded-lg bg-black/40 ring-1 ring-white/30 backdrop-blur-sm p-4 shadow-lg "
                                title={`Available on ${provider.name}`}
                            >
                                <Image
                                    src={provider.logo}
                                    alt={provider.name}
                                    fill
                                    className="object-contain p-1.5"
                                    sizes="28px"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* RELATIONS */}
                {relations && relations.length > 0 && (
                    <div
                        className="absolute bottom-3 right-3 z-20 opacity-100 md:opacity-0 transition-opacity duration-300 md:group-hover:opacity-100"
                        ref={relationsMenuRef}
                        onMouseEnter={() => setIsRelationsOpen(true)}
                        onMouseLeave={() => setIsRelationsOpen(false)}
                    >
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setIsRelationsOpen((prev) => !prev);
                            }}
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-neutral-300 hover:text-white hover:bg-black/70 transition-all shadow-lg",
                                isRelationsOpen ? "bg-black/80 ring-1 ring-white/20" : ""
                            )}
                        >
                            <Link size={14} />
                        </button>

                        <AnimatePresence>
                            {isRelationsOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-white/10 bg-neutral-950/95 backdrop-blur-xl p-2 shadow-xl"
                                >
                                    <div className="text-xs font-semibold text-neutral-400 mb-2 px-1">Related Entries</div>
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {relations.map((rel, idx) => {
                                            const match = entries.find(e => String(e.id) === rel.targetId);
                                            return (
                                                <div key={idx} className="flex flex-col rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors group/rel cursor-default" onClick={(e) => {
                                                    e.stopPropagation();
                                                }}>
                                                    <span className="text-[10px] text-neutral-500 font-medium uppercase tracking-wider">{rel.type}</span>
                                                    <span className="text-xs text-neutral-200 truncate group-hover/rel:text-white">{match ? match.title : "Unknown Entry"}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4 transition-all duration-300 translate-y-0 opacity-100 md:translate-y-2 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 media-card-info">
                    <h3 className="font-medium text-white line-clamp-2 text-shadow-sm media-card-title">{title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-neutral-300 media-card-meta">
                        {year && <span>{year}</span>}
                        {type && (
                            <>
                                <span className="w-1 h-1 rounded-full bg-neutral-500" />
                                <span className="capitalize">{type}</span>
                            </>
                        )}
                    </div>
                    {showActions && !isInvalid && (
                        <div className="flex gap-2 mt-2 media-card-actions">
                            {onEdit && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEdit();
                                    }}
                                    className="px-4 py-2 text-sm rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors media-card-action-button"
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
                                    className="px-4 py-2 text-s rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors media-card-action-button"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </DescriptionErrorWrapper>
        </GlassCard >
    );

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className={cn(
                "group relative media-card",
                onClick ? "cursor-pointer" : "",
                className,
            )}
            onClick={() => onClick?.()}
            onKeyDown={(event) => {
                if (!onClick) return;
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onClick();
                }
            }}
            role={onClick ? "button" : undefined}
            tabIndex={onClick ? 0 : undefined}
        >
            <div className="block w-full rounded-2xl">{content}</div>
        </motion.div>
    );
}
