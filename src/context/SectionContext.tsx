// File: src/context/SectionContext.tsx
// Purpose: Tracking the active navigation section via URL hash and manual updates

"use client";

// ─── React
import { createContext, type ReactNode, useContext } from "react";

// ─── Internal — hooks
import { type SectionKey, useSectionState } from "@/hooks/useSectionState";

export type { SectionKey };

interface SectionContextType {
  activeSection: SectionKey;
  setActiveSection: (section: SectionKey) => void;
}

// ─── Context Definition
const SectionContext = createContext<SectionContextType | undefined>(undefined);

// ─── Provider Component
export function SectionProvider({ children }: { children: ReactNode }) {
  const { activeSection, setActiveSection } = useSectionState();

  return (
    <SectionContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SectionContext.Provider>
  );
}

// ─── Hook: useSection
export function useSection() {
  const context = useContext(SectionContext);
  if (context === undefined) {
    throw new Error("useSection must be used within a SectionProvider");
  }
  return context;
}
