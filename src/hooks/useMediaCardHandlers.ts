// File: src/hooks/useMediaCardHandlers.ts
// Purpose: Orchestrates media card status updates, rating management, and action callbacks

"use client";

// ─── Firebase
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
// ─── React
import { useCallback, useState } from "react";
// ─── Internal — types
import type { EntryStatus } from "@/context/DataContext";
// ─── Internal — services
import { db } from "@/lib/firebase";

interface MediaCardHandlerOptions {
  uid: string | null;
  id?: string | number;
  currentStatus?: EntryStatus;
}

/**
 * Hook to manage media card interaction state and Firestore updates.
 */
export function useMediaCardHandlers({ uid, id, currentStatus }: MediaCardHandlerOptions) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const toggleStatus = useCallback(() => setIsStatusOpen((prev) => !prev), []);
  const toggleRating = useCallback(() => setIsRatingOpen((prev) => !prev), []);
  const closeStatus = useCallback(() => setIsStatusOpen(false), []);
  const closeRating = useCallback(() => setIsRatingOpen(false), []);

  const handleStatusChange = useCallback(
    async (next: EntryStatus) => {
      if (!uid || !id || currentStatus === next) {
        setIsStatusOpen(false);
        return;
      }
      try {
        await updateDoc(doc(db, "users", uid, "entries", String(id)), {
          status: next,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Status update failed:", err);
      } finally {
        setIsStatusOpen(false);
      }
    },
    [uid, id, currentStatus],
  );

  const handleRatingChange = useCallback(
    async (val: number) => {
      if (!uid || !id) return;
      try {
        await updateDoc(doc(db, "users", uid, "entries", String(id)), {
          userRating: val,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Rating update failed:", err);
      } finally {
        setIsRatingOpen(false);
      }
    },
    [uid, id],
  );

  return {
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
  };
}
