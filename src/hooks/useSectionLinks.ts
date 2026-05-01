// File: src/hooks/useSectionLinks.ts
// Purpose: Orchestrates navigation link logic and section switching

"use client";

// ─── Internal — hooks
import { useSection } from "@/context/SectionContext";
import { allSectionLinks } from "@/config/navigation";

/**
 * Hook to manage navigation links and their active state.
 */
export function useSectionLinks() {
  const { activeSection, setActiveSection } = useSection();

  const links = allSectionLinks.map((link) => ({
    ...link,
    isActive: activeSection === link.section,
  }));

  return {
    links,
    activeSection,
    setActiveSection,
  };
}
