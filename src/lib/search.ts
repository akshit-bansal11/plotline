// File: src/lib/search.ts
// Purpose: Centralized orchestration for multi-provider media search

import { searchIGDBGames } from "@/lib/search/igdbSearch";
import { searchMALAnime, searchMALManga } from "@/lib/search/malSearch";
import {
  applyFilters,
  mergeMovieSeriesResults,
  type SearchFilters,
  sanitizeResult,
} from "@/lib/search/mergeResults";
import { searchOMDB } from "@/lib/search/omdbSearch";
// ─── Internal — services
import { type SearchResult, searchTMDB } from "@/lib/search/tmdbSearch";

// ─── Internal — types
export type { SearchFilters, SearchResult };

// ─── Core Service: Multi-Provider Search
/**
 * Performs a search across multiple providers (TMDB, OMDB, MAL, IGDB) based on filters.
 * Merges results, applies sanitization, and filters the final set.
 */
export async function performMultiProviderSearch(
  query: string,
  filters: SearchFilters,
): Promise<{ results: SearchResult[]; errors: string[] }> {
  const errors: string[] = [];
  let results: SearchResult[] = [];

  try {
    if (filters.baseType) {
      if (filters.baseType === "movie" || filters.baseType === "series") {
        const [tmdb, omdb] = await Promise.all([
          searchTMDB(query),
          searchOMDB(query, filters.baseType as "movie" | "series"),
        ]);
        if (tmdb.error) errors.push(tmdb.error);
        if (omdb.error) errors.push(omdb.error);
        results = mergeMovieSeriesResults(
          tmdb.results.filter((r) => r.type === filters.baseType),
          omdb.results.filter((r) => r.type === filters.baseType),
        );
      } else if (filters.baseType === "anime") {
        const res = await searchMALAnime(query);
        results = res.results;
        if (res.error) errors.push(res.error);
      } else if (filters.baseType === "manga") {
        const res = await searchMALManga(query);
        results = res.results;
        if (res.error) errors.push(res.error);
      } else if (filters.baseType === "game") {
        const res = await searchIGDBGames(query);
        results = res.results;
        if (res.error) errors.push(res.error);
      }
    } else {
      const [tmdb, omdb, anime, manga, games] = await Promise.all([
        searchTMDB(query),
        searchOMDB(query),
        searchMALAnime(query),
        searchMALManga(query),
        searchIGDBGames(query),
      ]);
      [tmdb, omdb, anime, manga, games].forEach((r) => {
        if (r.error) errors.push(r.error);
      });
      results = [
        ...mergeMovieSeriesResults(tmdb.results, omdb.results),
        ...anime.results,
        ...manga.results,
        ...games.results,
      ];
    }

    const uniqueErrors = Array.from(new Set(errors));
    const filtered = applyFilters(results.map(sanitizeResult), filters);

    return { results: filtered, errors: uniqueErrors };
  } catch (err) {
    console.error("[search] service error:", err);
    throw new Error("Internal search service error.");
  }
}
