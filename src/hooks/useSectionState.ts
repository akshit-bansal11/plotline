// File: src/hooks/useSectionState.ts
// Purpose: Manages navigation section state with URL hash synchronization

"use client";

// ─── React
import { useEffect, useState, useCallback } from "react";

// ─── Types
export type SectionKey = "home" | "movies" | "series" | "anime" | "manga" | "games";

/**
 * Normalizes a URL hash or raw string into a valid SectionKey.
 */
export const normalizeSection = (hash: string): SectionKey => {
  const raw = hash.replace(/^#/, "").trim().toLowerCase();
  if (!raw || raw === "home") return "home";
  if (raw === "movies" || raw === "movie") return "movies";
  if (raw === "series") return "series";
  if (raw === "anime") return "anime";
  if (raw === "manga") return "manga";
  if (raw === "games" || raw === "game") return "games";
  return "home";
};

/**
 * Hook to manage active section state with URL sync.
 */
export function useSectionState() {
  const [activeSection, setInternalActiveSection] = useState<SectionKey>("home");

  const setActiveSection = useCallback((section: SectionKey) => {
    setInternalActiveSection(section);
    // Note: We don't manually push hash here to avoid infinite loops
    // as hashchange listener will catch it if pushed via link.
    // If we want manual push:
    // window.location.hash = section === "home" ? "" : section;
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const currentHash = typeof window !== "undefined" ? window.location.hash : "";
      const normalized = normalizeSection(currentHash);
      setInternalActiveSection(normalized);
    };

    syncFromHash();

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash);

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, []);

  return { activeSection, setActiveSection };
}
