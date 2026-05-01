// File: src/utils/ott.ts
/* NOTE: OTT availability is simulated via deterministic hash. 
   Replace pickProviders with a real streaming availability API (e.g., Watchmode, Utelly) for production. */
// Purpose: Deterministic simulation of OTT availability based on title and location

// ─── Internal — constants
import {
  STREAMING_PROVIDERS,
  ANIME_PROVIDERS,
  GAME_PROVIDERS,
  type OTTProvider,
} from "@/constants/ottProviders";

/**
 * Simulates a set of available providers using a deterministic hash of the title and a seed (e.g., country).
 * This ensures the same title in the same country always shows the same providers.
 */
const pickProviders = (pool: OTTProvider[], title: string, seed: string): OTTProvider[] => {
  let hash = 0;
  const str = (title + seed).toLowerCase();
  
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const rand = Math.abs(hash % 100);
  let count = 0;
  
  if (rand < 20) count = 0;
  else if (rand < 50) count = 1;
  else if (rand < 80) count = 2;
  else count = 3;

  if (count === 0) return [];

  const available: OTTProvider[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    const index = Math.abs((hash >> (i * 3)) % pool.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      available.push(pool[index]);
    }
  }

  return available;
};

/**
 * Determines which OTT providers (or game platforms) are "available" for a given media entry.
 */
export const getOTTAvailability = (
  title: string,
  country: string | null,
  mediaType?: string | null,
): OTTProvider[] => {
  // Manga: no badges
  if (mediaType === "manga") return [];

  // Games: show platform badges (country-independent)
  if (mediaType === "game") {
    return pickProviders(GAME_PROVIDERS, title, "game");
  }

  // No country selected: no streaming badges
  if (!country) return [];

  const pool = mediaType === "anime" ? ANIME_PROVIDERS : STREAMING_PROVIDERS;
  return pickProviders(pool, title, country);
};
