"use client";

import { motion } from "motion/react";
import { type DragEvent, useRef } from "react";
import { MediaCard } from "@/components/library/MediaCard";
import { cn } from "@/utils";

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
    type?: string;
    relations?: { targetId: string; type: string; createdAtMs: number }[];
    onClick?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    showActions?: boolean;
  }>;
  className?: string;
  showStatusControl?: boolean;
  sourceListId?: string | null;
  activeDragEntryId?: string | null;
  onItemDragStart?: (details: DragStartDetails) => void;
  onItemDragEnd?: () => void;
  onItemDragOverPosition?: (
    details: {
      targetEntryId: string;
      position: "before" | "after";
      sourceListId: string | null;
    } | null,
  ) => void;
  onItemDropPosition?: (details: {
    targetEntryId: string;
    position: "before" | "after";
    sourceListId: string | null;
  }) => void;
  onItemDropOnItem?: (details: { targetEntryId: string; sourceListId: string | null }) => void;
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
  showStatusControl = true,
  sourceListId = null,
  activeDragEntryId = null,
  onItemDragStart,
  onItemDragEnd,
  onItemDragOverPosition,
  onItemDropPosition,
  onItemDropOnItem,
  dropIndicatorEntryId = null,
  dropIndicatorPosition = null,
}: MediaGridProps) {
  const suppressClickRef = useRef(false);

  return (
    <motion.div
      variants={containerVariants}
      initial={false}
      animate="visible"
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3",
        className,
      )}
    >
      {items.map((item) => {
        const isActiveDrag =
          activeDragEntryId !== null && String(activeDragEntryId) === String(item.id);
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
              // Tag this as an internal app drag to avoid triggering external URL drop zones
              event.dataTransfer.setData("application/x-plotline-entry", String(item.id));
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
              if (activeDragEntryId === null) return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const y = event.clientY - rect.top;
              const x = event.clientX - rect.left;

              const isCenterY = y > rect.height * 0.25 && y < rect.height * 0.75;
              const isCenterX = x > rect.width * 0.25 && x < rect.width * 0.75;

              if (isCenterY && isCenterX && onItemDropOnItem) {
                onItemDragOverPosition?.(null); // Clear indicator
                event.currentTarget.classList.add("media-card-drop-target"); // Add a subtle visual cue if CSS exists
              } else if (onItemDragOverPosition) {
                event.currentTarget.classList.remove("media-card-drop-target");
                const position: "before" | "after" = y < rect.height / 2 ? "before" : "after";
                onItemDragOverPosition({
                  targetEntryId: String(item.id),
                  position,
                  sourceListId,
                });
              }
            }}
            onDragLeaveCapture={(event: DragEvent<HTMLDivElement>) => {
              event.currentTarget.classList.remove("media-card-drop-target");
            }}
            onDropCapture={(event: DragEvent<HTMLDivElement>) => {
              if (activeDragEntryId === null) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.classList.remove("media-card-drop-target");

              const rect = event.currentTarget.getBoundingClientRect();
              const y = event.clientY - rect.top;
              const x = event.clientX - rect.left;

              const isCenterY = y > rect.height * 0.25 && y < rect.height * 0.75;
              const isCenterX = x > rect.width * 0.25 && x < rect.width * 0.75;

              if (isCenterY && isCenterX && onItemDropOnItem) {
                onItemDropOnItem({
                  targetEntryId: String(item.id),
                  sourceListId,
                });
              } else if (onItemDropPosition) {
                const position: "before" | "after" = y < rect.height / 2 ? "before" : "after";
                onItemDropPosition({
                  targetEntryId: String(item.id),
                  position,
                  sourceListId,
                });
              }
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
              showStatusControl={showStatusControl}
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
