"use client";

import { BookOpen, Film, Gamepad2, Home, Sparkles, Tv } from "lucide-react";
import type { SectionKey } from "@/context/SectionContext";

export type SectionLink = {
  href: string;
  label: string;
  section: SectionKey;
  icon?: typeof Home;
};

export const homeSectionLink: SectionLink = {
  href: "/",
  label: "Home",
  section: "home",
  icon: Home,
};

export const categorySectionLinks: SectionLink[] = [
  { href: "/#movies", label: "Movies", section: "movies", icon: Film },
  { href: "/#series", label: "Series", section: "series", icon: Tv },
  { href: "/#anime", label: "Anime", section: "anime", icon: Sparkles },
  { href: "/#manga", label: "Manga", section: "manga", icon: BookOpen },
  { href: "/#games", label: "Games", section: "games", icon: Gamepad2 },
];

export const allSectionLinks: SectionLink[] = [homeSectionLink, ...categorySectionLinks];

export type SectionConfig = {
  title: string;
  mediaTypes: string[];
  gridType: string;
};

export const sectionConfigs: Record<Exclude<SectionKey, "home">, SectionConfig> = {
  movies: { title: "Movies", mediaTypes: ["movie"], gridType: "movie" },
  series: { title: "Series", mediaTypes: ["series"], gridType: "series" },
  anime: {
    title: "Anime",
    mediaTypes: ["anime", "anime_movie"],
    gridType: "anime",
  },
  manga: { title: "Manga", mediaTypes: ["manga"], gridType: "manga" },
  games: { title: "Games", mediaTypes: ["game"], gridType: "game" },
};
