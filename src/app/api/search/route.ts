// File: src/app/api/search/route.ts
// Purpose: Multi-provider search API route — thin orchestrator using extracted modules

// ─── Imports: Third-party
import { NextResponse } from "next/server";
// ─── Internal — constants/config
import {
  RATE_LIMIT_WINDOW_MS,
  SEARCH_CACHE_TTL_MS,
  SEARCH_RATE_LIMIT_MAX,
} from "@/constants/limits";
// ─── Internal — utils/lib
import { createInMemoryRateLimit } from "@/lib/rateLimit";
import { performMultiProviderSearch, type SearchFilters } from "@/lib/search";
import { sanitizeResult } from "@/lib/search/mergeResults";

// ─── Internal — schemas
import { searchParamsSchema } from "@/schemas/logEntry";
// ─── Internal — utils/search
import {
  type ApiSearchStatus,
  type ApiSearchType,
  getBaseTypeFromSearchType,
  normalizeGamePlatform,
  normalizeGenreName,
  normalizeSerializationName,
  normalizeStudioName,
  normalizeSubtype,
} from "@/utils/searchFilters";

// ─── State: Caches & Limiter
const cache = new Map<string, { timestamp: number; results: any[]; errors: string[] }>();
const limiter = createInMemoryRateLimit(RATE_LIMIT_WINDOW_MS, SEARCH_RATE_LIMIT_MAX);

/**
 * Extracts the client's IP address for rate limiting.
 */
const getClientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";
  return request.headers.get("x-real-ip") || "anonymous";
};

/**
 * Parses filter parameters from the URL.
 */
const parseFilterParams = (searchParams: URLSearchParams): SearchFilters => {
  const rawType = searchParams.get("type");
  const searchType = (
    ["movie", "series", "anime", "anime_movie", "manga", "game"].includes(rawType || "")
      ? rawType
      : null
  ) as ApiSearchType | null;

  const baseType = getBaseTypeFromSearchType(searchType);
  const explicitSubtype = baseType ? normalizeSubtype(baseType, searchParams.get("subtype")) : null;
  const subtype = searchType === "anime_movie" ? "movie" : explicitSubtype;

  const genres = new Set<string>();
  searchParams
    .get("genres")
    ?.split(",")
    .forEach((g) => {
      const n = normalizeGenreName(g);
      if (n) genres.add(n);
    });

  const rawStatus = searchParams.get("status");
  const status = (
    ["finished", "airing", "tba", "not_yet_aired"].includes(rawStatus || "") ? rawStatus : null
  ) as ApiSearchStatus | null;

  return {
    searchType,
    baseType,
    subtype,
    genres,
    yearMin: Number(searchParams.get("yearMin")) || null,
    yearMax: Number(searchParams.get("yearMax")) || null,
    ratingMin: Number(searchParams.get("ratingMin")) || null,
    episodeMin: Number(searchParams.get("episodeMin")) || null,
    chapterMin: Number(searchParams.get("chapterMin")) || null,
    status,
    studio: normalizeStudioName(searchParams.get("studio")),
    platform: normalizeGamePlatform(searchParams.get("platform")),
    serialization: normalizeSerializationName(searchParams.get("serialization")),
  };
};

// ─── Route Handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  // ─── Validation
  const parsed = searchParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { results: [], errors: ["Invalid search parameters."] },
      { status: 400 },
    );
  }

  const query = parsed.data.q.trim();

  // ─── Rate Limiting
  const clientKey = getClientKey(request);
  if (!limiter.check(clientKey)) {
    return NextResponse.json(
      { results: [], errors: ["Too many requests. Please wait."] },
      { status: 429 },
    );
  }

  // ─── Caching
  const cacheKey = searchParams.toString().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL_MS) {
    return NextResponse.json({ results: cached.results, errors: cached.errors, cached: true });
  }

  // ─── Data Fetching
  const filters = parseFilterParams(searchParams);

  try {
    const { results, errors } = await performMultiProviderSearch(query, filters);

    const sanitizedResults = results.map(sanitizeResult).slice(0, parsed.data.limit);

    cache.set(cacheKey, {
      timestamp: Date.now(),
      results: sanitizedResults,
      errors,
    });

    return NextResponse.json(
      {
        results: sanitizedResults,
        errors,
        cached: false,
      },
      {
        headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
      },
    );
  } catch (err) {
    console.error("[search] route error:", err);
    return NextResponse.json({ results: [], errors: ["Internal search error."] }, { status: 500 });
  }
}
