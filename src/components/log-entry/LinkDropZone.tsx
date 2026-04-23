"use client";

import { ExternalLink, Link2, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractUrlFromDragEvent, parseMediaUrl } from "@/utils/parseMediaUrl";

type ResolvedMedia = {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: "movie" | "series" | "anime" | "manga" | "game";
  description?: string;
  rating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
};

type LinkDropZoneProps = {
  onResolved: (media: ResolvedMedia) => void;
  disabled?: boolean;
  onRequireAuth?: () => void;
};

const SOURCE_LABELS: Record<string, string> = {
  imdb: "IMDb",
  tmdb: "TMDB",
  mal: "MyAnimeList",
  netflix: "Netflix",
  prime: "Prime Video",
};

export function LinkDropZone({ onResolved, disabled, onRequireAuth }: LinkDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [droppedUrl, setDroppedUrl] = useState<string | null>(null);
  const dragCounterRef = useRef(0);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear error after delay
  useEffect(() => {
    if (error) {
      errorTimeoutRef.current = setTimeout(() => setError(null), 5000);
      return () => {
        if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      };
    }
  }, [error]);

  const handleResolve = useCallback(
    async (url: string) => {
      if (disabled) {
        onRequireAuth?.();
        return;
      }

      setIsProcessing(true);
      setError(null);
      setDroppedUrl(url);

      try {
        const res = await fetch("/api/resolve-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const payload = await res.json();

        if (!res.ok || !payload.data) {
          setError(payload.error || "Could not resolve this link.");
          return;
        }

        onResolved(payload.data);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setIsProcessing(false);
        setDroppedUrl(null);
      }
    },
    [disabled, onRequireAuth, onResolved],
  );

  // — Global drag-and-drop listeners —
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Only show overlay if the drag contains text/URLs and is NOT an internal app drag
      const isInternalDrag = e.dataTransfer?.types.includes("application/x-plotline-entry");
      const hasUrlType =
        e.dataTransfer?.types.includes("text/plain") ||
        e.dataTransfer?.types.includes("text/uri-list");

      if (isInternalDrag || !hasUrlType) {
        return;
      }
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragOver(true);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const isInternalDrag = e.dataTransfer?.types.includes("application/x-plotline-entry");
      const hasUrlType =
        e.dataTransfer?.types.includes("text/plain") ||
        e.dataTransfer?.types.includes("text/uri-list");

      if (isInternalDrag || !hasUrlType) {
        return;
      }
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "link";
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragOver(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      if (!e.dataTransfer) return;

      // Ignore if it's an internal drag
      if (e.dataTransfer.types.includes("application/x-plotline-entry")) {
        return;
      }

      const url = extractUrlFromDragEvent(e.dataTransfer);
      if (!url) {
        setError("No URL detected. Drag a link from IMDb, TMDB, MAL, Netflix, or Prime Video.");
        return;
      }

      const parsed = parseMediaUrl(url);
      if (!parsed) {
        setError("Unrecognized link. Try IMDb, TMDB, MyAnimeList, Netflix, or Prime Video.");
        return;
      }

      handleResolve(url);
    };

    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("drop", handleDrop);

    return () => {
      document.removeEventListener("dragenter", handleDragEnter);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("dragleave", handleDragLeave);
      document.removeEventListener("drop", handleDrop);
    };
  }, [handleResolve]);

  // Determine source label for the active URL
  const sourceLabel = droppedUrl
    ? (() => {
        const parsed = parseMediaUrl(droppedUrl);
        return parsed ? SOURCE_LABELS[parsed.source] || parsed.source : null;
      })()
    : null;

  return (
    <>
      {/* Full-page drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ pointerEvents: "none" }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm" />

            {/* Animated border */}
            <div className="absolute inset-3 rounded-3xl border-2 border-dashed border-blue-400/50 animate-pulse" />

            {/* Center content */}
            <div className="relative flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10 backdrop-blur-xl"
              >
                <Link2 size={32} className="text-blue-400" />
              </motion.div>
              <div className="space-y-2">
                <div className="text-lg font-semibold text-white">Drop media link</div>
                <div className="text-sm text-neutral-400 max-w-xs">
                  IMDb · TMDB · MyAnimeList · Netflix · Prime Video
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing overlay */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-neutral-900/90 p-8 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10">
                <Loader2 size={28} className="text-blue-400 animate-spin" />
              </div>
              <div className="space-y-1 text-center">
                <div className="text-sm font-semibold text-white">
                  Resolving {sourceLabel || "link"}…
                </div>
                {droppedUrl && (
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 max-w-xs truncate">
                    <ExternalLink size={10} className="shrink-0" />
                    <span className="truncate">{droppedUrl}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast */}
      <AnimatePresence>
        {error && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-red-400/20 bg-neutral-900/95 px-5 py-3.5 shadow-2xl backdrop-blur-xl">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <X size={14} className="text-red-400" />
              </div>
              <div className="text-sm text-neutral-200 max-w-sm">{error}</div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="ml-2 shrink-0 rounded-full p-1 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
