// File: src/data/navigation.ts
// Purpose: Navigation links and configuration for application sections

// ─── Third-party: Icons
import { BookOpen, Film, Gamepad2, Home, type LucideIcon, Sparkles, Tv } from "lucide-react";

// ─── Internal — types
import type { SectionKey } from "@/context/SectionContext";

export interface SectionLink {
  readonly href: string;
  readonly label: string;
  readonly section: SectionKey;
  readonly icon?: LucideIcon;
}

export interface SectionConfig {
  readonly title: string;
  readonly mediaTypes: readonly string[];
  readonly gridType: string;
}

// ─── Links
export const homeSectionLink: SectionLink = {
  href: "/",
  label: "Home",
  section: "home",
  icon: Home,
} as const;

export const categorySectionLinks: ReadonlyArray<SectionLink> = [
  { href: "/#movies", label: "Movies", section: "movies", icon: Film },
  { href: "/#series", label: "Series", section: "series", icon: Tv },
  { href: "/#anime", label: "Anime", section: "anime", icon: Sparkles },
  { href: "/#manga", label: "Manga", section: "manga", icon: BookOpen },
  { href: "/#games", label: "Games", section: "games", icon: Gamepad2 },
] as const;

export const allSectionLinks: ReadonlyArray<SectionLink> = [
  homeSectionLink,
  ...categorySectionLinks,
] as const;

// ─── Configurations
export const sectionConfigs: Readonly<Record<Exclude<SectionKey, "home">, SectionConfig>> = {
  movies: { title: "Movies", mediaTypes: ["movie"], gridType: "movie" },
  series: { title: "Series", mediaTypes: ["series"], gridType: "series" },
  anime: {
    title: "Anime",
    mediaTypes: ["anime", "anime_movie"],
    gridType: "anime",
  },
  manga: { title: "Manga", mediaTypes: ["manga"], gridType: "manga" },
  games: { title: "Games", mediaTypes: ["game"], gridType: "game" },
} as const;
