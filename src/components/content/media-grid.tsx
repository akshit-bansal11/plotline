"use client";

import type { DragEvent } from "react";
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
        image: string | null;
        year?: string;
        userRating?: number | null;
        imdbRating?: number | null;
        status?: import("@/context/data-context").EntryStatus;
        type?: string;
        onView?: () => void;
        onEdit?: () => void;
        onDelete?: () => void;
        showActions?: boolean;
    }>;
    className?: string;
    sourceListId?: string | null;
    activeDragEntryId?: string | null;
    onItemDragStart?: (details: DragStartDetails) => void;
    onItemDragEnd?: () => void;
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
}: MediaGridProps) {
    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6", className)}
        >
            {items.map((item) => {
                const isActiveDrag = activeDragEntryId !== null && String(activeDragEntryId) === String(item.id);
                return (
                    <motion.div
                        key={item.id}
                        variants={itemVariants}
                        draggable={Boolean(onItemDragStart)}
                        onDragStartCapture={(event: DragEvent<HTMLDivElement>) => {
                            if (!onItemDragStart) return;
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
                            onView={item.onView}
                            onEdit={item.onEdit}
                            onDelete={item.onDelete}
                            showActions={item.showActions}
                        />
                    </motion.div>
                );
            })}
        </motion.div>
    );
}
