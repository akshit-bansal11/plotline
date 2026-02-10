"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type SectionKey = "home" | "movies" | "series" | "anime" | "manga" | "games";

interface SectionContextType {
  activeSection: SectionKey;
  setActiveSection: (section: SectionKey) => void;
}

const SectionContext = createContext<SectionContextType | undefined>(undefined);

const normalizeSection = (hash: string): SectionKey => {
  const raw = hash.replace(/^#/, "").trim().toLowerCase();
  if (!raw || raw === "home") return "home";
  if (raw === "movies" || raw === "movie") return "movies";
  if (raw === "series") return "series";
  if (raw === "anime") return "anime";
  if (raw === "manga") return "manga";
  if (raw === "games" || raw === "game") return "games";
  return "home";
};

export function SectionProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<SectionKey>("home");

  // Sync with URL hash on mount and changes
  useEffect(() => {
    const syncFromHash = () => {
      const currentHash = window.location.hash;
      const normalized = normalizeSection(currentHash);
      setActiveSection(normalized);
    };

    // Initial sync
    syncFromHash();

    // Listen for hash changes (e.g. back button, or manual hash updates)
    // Note: Next.js Link pushState does NOT trigger hashchange/popstate on its own in all cases,
    // so we rely on explicit setActiveSection calls from NavLinks for click interactions.
    // But popstate handles browser Back/Forward navigation.
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("popstate", syncFromHash); // Important for history navigation

    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("popstate", syncFromHash);
    };
  }, []);

  return (
    <SectionContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  const context = useContext(SectionContext);
  if (context === undefined) {
    throw new Error("useSection must be used within a SectionProvider");
  }
  return context;
}
