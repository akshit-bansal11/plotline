// File: src/utils/index.ts
// Purpose: Core utilities and shared display labels for the application

// ─── Third-party
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes with clsx for conditional styles.
 */
export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};

// ─── Constants: Status Labels
export const entryStatusLabels: Readonly<Record<string, string>> = {
  watching: "Watching",
  rewatching: "Rewatching",
  completed: "Completed",
  plan_to_watch: "Plan to watch",
  on_hold: "On hold",
  dropped: "Dropped",
  reading: "Reading",
  rereading: "Rereading",
  plan_to_read: "Plan to read",
  playing: "Playing",
  replaying: "Replaying",
  plan_to_play: "Plan to play",
  unspecified: "Unspecified",
  main_story_completed: "Main Story Completed",
  fully_completed: "Fully Completed",
  backlogged: "Backlogged",
  bored: "Bored",
  own: "Own",
  wishlist: "Wishlist",
  not_committed: "Playing",
  committed: "Committed",
} as const;

// ─── Constants: Media Type Labels
export const entryMediaTypeLabels: Readonly<Record<string, string>> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  anime_movie: "Anime movie",
  manga: "Manga",
  game: "Game",
} as const;
