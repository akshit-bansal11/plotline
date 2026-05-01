// File: src/components/library/MediaGrid.tsx
// Purpose: Renders a responsive grid of media items with integrated drag-and-drop orchestration

"use client";

// ─── React
import { type DragEvent, useRef } from "react";

// ─── Third-party: Framer Motion
import { motion } from "motion/react";

// ─── Internal — components
import { MediaCard } from "@/components/library/MediaCard";

// ─── Internal — utils
import { cn } from "@/utils";

// ─── Types
export type DragStartDetails = {
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
  onItemDragOverPosition?: (details: { targetEntryId: string; position: "before" | "after"; sourceListId: string | null } | null) => void;
  onItemDropPosition?: (details: { targetEntryId: string; position: "before" | "after"; sourceListId: string | null }) => void;
  onItemDropOnItem?: (details: { targetEntryId: string; sourceListId: string | null }) => void;
  dropIndicatorEntryId?: string | null;
  dropIndicatorPosition?: "before" | "after" | null;
}

// ─── Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3 } }
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Responsive grid for media cards with advanced drag-and-drop support.
 */
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
      initial="hidden"
      animate="visible"
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6",
        className
      )}
    >
      {items.map((item) => {
        const isActiveDrag = activeDragEntryId !== null && String(activeDragEntryId) === String(item.id);
        const isDropIndicator = dropIndicatorEntryId !== null && String(dropIndicatorEntryId) === String(item.id) && Boolean(dropIndicatorPosition);

        return (
          <motion.div
            key={item.id}
            variants={itemVariants}
            className={cn("relative group", isActiveDrag && "opacity-40 grayscale")}
            draggable={!!onItemDragStart}
            onDragStartCapture={(e: DragEvent<HTMLDivElement>) => {
              if (!onItemDragStart) return;
              suppressClickRef.current = true;
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("application/x-plotline-entry", String(item.id));
              onItemDragStart({ entryId: item.id, sourceListId, title: item.title, mode: "mouse" });
            }}
            onDragEndCapture={() => {
              onItemDragEnd?.();
              setTimeout(() => { suppressClickRef.current = false; }, 0);
            }}
            onDragOverCapture={(e: DragEvent<HTMLDivElement>) => {
              if (activeDragEntryId === null) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const x = e.clientX - rect.left;

              const isCenter = y > rect.height * 0.25 && y < rect.height * 0.75 && x > rect.width * 0.25 && x < rect.width * 0.75;

              if (isCenter && onItemDropOnItem) {
                onItemDragOverPosition?.(null);
                e.currentTarget.classList.add("ring-2", "ring-blue-500", "ring-inset");
              } else if (onItemDragOverPosition) {
                e.currentTarget.classList.remove("ring-2", "ring-blue-500", "ring-inset");
                onItemDragOverPosition({
                  targetEntryId: String(item.id),
                  position: y < rect.height / 2 ? "before" : "after",
                  sourceListId
                });
              }
            }}
            onDragLeaveCapture={(e) => {
              e.currentTarget.classList.remove("ring-2", "ring-blue-500", "ring-inset");
            }}
            onDropCapture={(e: DragEvent<HTMLDivElement>) => {
              if (activeDragEntryId === null) return;
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.classList.remove("ring-2", "ring-blue-500", "ring-inset");

              const rect = e.currentTarget.getBoundingClientRect();
              const y = e.clientY - rect.top;
              const x = e.clientX - rect.left;
              const isCenter = y > rect.height * 0.25 && y < rect.height * 0.75 && x > rect.width * 0.25 && x < rect.width * 0.75;

              if (isCenter && onItemDropOnItem) {
                onItemDropOnItem({ targetEntryId: String(item.id), sourceListId });
              } else if (onItemDropPosition) {
                onItemDropPosition({
                  targetEntryId: String(item.id),
                  position: y < rect.height / 2 ? "before" : "after",
                  sourceListId
                });
              }
            }}
          >
            <MediaCard
              {...item}
              onClick={() => {
                if (suppressClickRef.current) return;
                item.onClick?.();
              }}
              showStatusControl={showStatusControl}
            />
            {isDropIndicator && (
              <div
                className={cn(
                  "pointer-events-none absolute inset-y-0 w-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-30 rounded-full",
                  dropIndicatorPosition === "before" ? "-left-3" : "-right-3"
                )}
              />
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
