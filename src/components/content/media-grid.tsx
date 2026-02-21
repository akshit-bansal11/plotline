"use client";

import { useRef, type DragEvent } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { MediaCard } from "./media-card";

type DragStartDetails = {
    entryId: string | number;
    sourceListId: string | null;
    title: string;
    mode: "mouse" | "keyboard" | "touch";
};

interface MediaGridProps {
    items: Array<{
        id: string | number;
        title: string;
        description?: string;
        image: string | null;
        year?: string;
        userRating?: number | null;
        imdbRating?: number | null;
        status?: import("@/context/data-context").EntryStatus;
        type?: string;
        onClick?: () => void;
        onEdit?: () => void;
        onDelete?: () => void;
        showActions?: boolean;
    }>;
    className?: string;
    sourceListId?: string | null;
    activeDragEntryId?: string | null;
    onItemDragStart?: (details: DragStartDetails) => void;
    onItemDragEnd?: () => void;
    onItemDragOverPosition?: (details: {
        targetEntryId: string;
        position: "before" | "after";
        sourceListId: string | null;
    }) => void;
    onItemDropPosition?: (details: {
        targetEntryId: string;
        position: "before" | "after";
        sourceListId: string | null;
    }) => void;
    dropIndicatorEntryId?: string | null;
    dropIndicatorPosition?: "before" | "after" | null;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function MediaGrid({
    items,
    className,
    sourceListId = null,
    activeDragEntryId = null,
    onItemDragStart,
    onItemDragEnd,
    onItemDragOverPosition,
    onItemDropPosition,
    dropIndicatorEntryId = null,
    dropIndicatorPosition = null,
}: MediaGridProps) {
    const suppressClickRef = useRef(false);

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6", className)}
        >
            {items.map((item) => {
                const isActiveDrag = activeDragEntryId !== null && String(activeDragEntryId) === String(item.id);
                const isDropIndicator =
                    dropIndicatorEntryId !== null &&
                    String(dropIndicatorEntryId) === String(item.id) &&
                    Boolean(dropIndicatorPosition);
                return (
                    <motion.div
                        key={item.id}
                        variants={itemVariants}
                        className="relative"
                        draggable={Boolean(onItemDragStart)}
                        onDragStartCapture={(event: DragEvent<HTMLDivElement>) => {
                            if (!onItemDragStart) return;
                            suppressClickRef.current = true;
                            event.dataTransfer.effectAllowed = "move";
                            onItemDragStart({
                                entryId: item.id,
                                sourceListId,
                                title: item.title,
                                mode: "mouse",
                            });
                            event.currentTarget.classList.add("media-card-dragging");
                        }}
                        onDragEndCapture={(event: DragEvent<HTMLDivElement>) => {
                            event.currentTarget.classList.remove("media-card-dragging");
                            onItemDragEnd?.();
                            window.setTimeout(() => {
                                suppressClickRef.current = false;
                            }, 0);
                        }}
                        onDragOverCapture={(event: DragEvent<HTMLDivElement>) => {
                            if (!onItemDragOverPosition || activeDragEntryId === null) return;
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const position: "before" | "after" =
                                event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            onItemDragOverPosition({
                                targetEntryId: String(item.id),
                                position,
                                sourceListId,
                            });
                        }}
                        onDropCapture={(event: DragEvent<HTMLDivElement>) => {
                            if (!onItemDropPosition || activeDragEntryId === null) return;
                            event.preventDefault();
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const position: "before" | "after" =
                                event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                            onItemDropPosition({
                                targetEntryId: String(item.id),
                                position,
                                sourceListId,
                            });
                        }}
                        onTouchStart={() => {
                            if (!onItemDragStart) return;
                            onItemDragStart({
                                entryId: item.id,
                                sourceListId,
                                title: item.title,
                                mode: "touch",
                            });
                        }}
                        onKeyDown={(event) => {
                            if (!onItemDragStart) return;
                            if (event.key === " " || event.key === "Enter") {
                                event.preventDefault();
                                onItemDragStart({
                                    entryId: item.id,
                                    sourceListId,
                                    title: item.title,
                                    mode: "keyboard",
                                });
                            }
                        }}
                        aria-grabbed={isActiveDrag}
                    >
                        <MediaCard
                            {...item}
                            onClick={() => {
                                if (suppressClickRef.current) return;
                                item.onClick?.();
                            }}
                            onEdit={item.onEdit}
                            onDelete={item.onDelete}
                            showActions={item.showActions}
                        />
                        {isDropIndicator ? (
                            <div
                                aria-hidden="true"
                                className={cn(
                                    "pointer-events-none absolute inset-y-3 z-20 w-0.5 rounded-full bg-blue-300 shadow-[0_0_12px_rgba(147,197,253,0.9)]",
                                    dropIndicatorPosition === "before" ? "-left-2" : "-right-2",
                                )}
                            />
                        ) : null}
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
