// File: src/components/library/MediaCard.tsx
// Purpose: Atomic component for displaying a media item with status, rating, and OTT info

"use client";

// ─── React
import { useCallback, useRef, useState } from "react";

// ─── Firebase
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

// ─── Icons
import { Link } from "lucide-react";

// ─── Third-party
import { motion } from "motion/react";

// ─── Internal — components
import { GlassCard } from "@/components/ui/GlassCard";
import { MediaCardHeader } from "@/components/log-entry/MediaCardHeader";
import { MediaCardFooter } from "@/components/log-entry/MediaCardFooter";
import { MediaCardImage } from "@/components/log-entry/MediaCardImage";
import { CardStatusMenu } from "@/components/log-entry/CardStatusMenu";
import { CardRatingMenu } from "@/components/log-entry/CardRatingMenu";

// ─── Internal — hooks/context
import { useAuth } from "@/context/AuthContext";
import { useMediaCardHandlers } from "@/hooks/useMediaCardHandlers";

// ─── Internal — types
import type { EntryMediaType, EntryStatus } from "@/context/DataContext";

// ─── Internal — utils
import { cn } from "@/utils";

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
  showStatusControl?: boolean;
}

/**
 * Renders an interactive media card with poster, metadata overlays, and status management.
 */
export function MediaCard({
  id,
  title,
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
  showStatusControl = true,
}: MediaCardProps) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  const {
    isStatusOpen,
    isRatingOpen,
    imageLoaded,
    setImageLoaded,
    toggleStatus,
    toggleRating,
    closeStatus,
    closeRating,
    handleStatusChange,
    handleRatingChange,
  } = useMediaCardHandlers({ uid, id, currentStatus: status });

  // ─── Handlers: Actions
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  }, [onEdit]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      className={cn("group relative", className)}
      onClick={onClick}
    >
      <GlassCard 
        className={cn(
          "overflow-hidden p-0 border-white/5 bg-zinc-900/40 relative",
          aspectRatio === "poster" ? "aspect-[2/3]" : "aspect-video"
        )}
        hoverEffect
      >
        <MediaCardImage 
          image={image} 
          title={title} 
          imageLoaded={imageLoaded} 
          onLoad={() => setImageLoaded(true)} 
        />

        <MediaCardHeader 
          userRating={userRating} 
          status={status} 
          showStatusControl={showStatusControl} 
        <MediaCardHeader 
          userRating={userRating} 
          status={status} 
          showStatusControl={showStatusControl} 
          onStatusClick={toggleStatus}
          onRatingClick={toggleRating}
        />
 
        {isStatusOpen && (
          <CardStatusMenu 
            currentStatus={status || "unspecified"} 
            mediaType={(type as EntryMediaType) || "movie"} 
            onStatusChange={handleStatusChange} 
            onClose={closeStatus}
          />
        )}
 
        {isRatingOpen && (
          <CardRatingMenu 
            currentRating={userRating} 
            onRatingChange={handleRatingChange} 
            onClose={closeRating}
          />
        )}

        <MediaCardFooter 
          title={title} 
          year={year} 
          type={type} 
          showActions={showActions} 
          onEdit={handleEdit} 
          onDelete={handleDelete} 
        />

        {/* Relations Icon */}
        {relations && relations.length > 0 && (
          <div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-zinc-400 shadow-xl">
              <Link className="w-3 h-3" />
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
