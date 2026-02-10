import { NextResponse } from "next/server";

type SearchSource = "tmdb" | "omdb" | "mal";
type MediaType = "movie" | "series" | "anime" | "manga" | "game";

interface SearchResult {
  id: string | number;
  title: string;
  image: string | null;
  year?: string;
  type: MediaType;
  source: SearchSource;
  overview?: string;
  rating?: number | null;
}

interface TmdbResult {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  overview?: string;
  vote_average?: number;
}

interface OmdbResult {
  imdbID: string;
  Title: string;
  Poster: string;
  Year: string;
  Type: string;
}

interface MalNode {
  id: number;
  title: string;
  main_picture?: { medium?: string };
  start_date?: string;
  synopsis?: string;
  mean?: number;
}

interface MalItem {
  node: MalNode;
}

const cache = new Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>();
const rateLimit = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;
const CACHE_TTL = 1000 * 60 * 5;

const getClientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";
  return request.headers.get("x-real-ip") || "anonymous";
};

const checkRateLimit = (key: string) => {
  const now = Date.now();
  const existing = rateLimit.get(key);
  if (!existing || existing.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX) return false;
  existing.count += 1;
  return true;
};

type FetchResult = { ok: true; data: unknown } | { ok: false; error: string };

const safeFetchJson = async (url: string, init?: RequestInit): Promise<FetchResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `Request failed with status ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
};

const searchTMDB = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return { results: [] as SearchResult[], error: "TMDB is not configured." };

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  const response = await safeFetchJson(finalUrl, { headers });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { results?: TmdbResult[] };
  const rawResults = payload.results || [];
  const results: SearchResult[] = rawResults
    .filter((item) => item.media_type !== "person")
    .map((item) => {
      const mediaType: MediaType = item.media_type === "tv" ? "series" : "movie";
      return {
        id: item.id,
        title: item.title || item.name || "",
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        year: (item.release_date || item.first_air_date || "").split("-")[0],
        type: mediaType,
        source: "tmdb" as const,
        overview: item.overview || "",
        rating: item.vote_average ?? null,
      };
    });

  return { results, error: "" };
};

const searchOMDB = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return { results: [] as SearchResult[], error: "OMDb is not configured." };

  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`;
  const response = await safeFetchJson(url);
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };
  const payload = response.data as { Response?: string; Search?: OmdbResult[] };
  if (payload.Response === "False") return { results: [] as SearchResult[], error: "" };

  const rawResults = payload.Search || [];
  const results: SearchResult[] = rawResults.map((item) => {
    const mediaType: MediaType = item.Type === "series" ? "series" : item.Type === "game" ? "game" : "movie";
    return {
      id: item.imdbID,
      title: item.Title,
      image: item.Poster !== "N/A" ? item.Poster : null,
      year: item.Year,
      type: mediaType,
      source: "omdb" as const,
      overview: "",
      rating: null,
    };
  });

  return { results, error: "" };
};

const searchMALAnime = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return { results: [] as SearchResult[], error: "MyAnimeList is not configured." };

  const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(query)}&limit=8&fields=title,main_picture,start_date,mean,synopsis`;
  const response = await safeFetchJson(url, { headers: { "X-MAL-CLIENT-ID": clientId } });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];
  const results: SearchResult[] = rawResults.map((item) => {
    return {
      id: item.node.id,
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "anime",
      source: "mal" as const,
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
    };
  });

  return { results, error: "" };
};

const searchMALManga = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return { results: [] as SearchResult[], error: "MyAnimeList is not configured." };

  const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(query)}&limit=8&fields=title,main_picture,start_date,mean,synopsis`;
  const response = await safeFetchJson(url, { headers: { "X-MAL-CLIENT-ID": clientId } });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];
  const results: SearchResult[] = rawResults.map((item) => {
    return {
      id: item.node.id,
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "manga",
      source: "mal" as const,
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
    };
  });

  return { results, error: "" };
};

const dedupeResults = (items: SearchResult[]) => {
  const seen = new Map<string, SearchResult>();
  for (const item of items) {
    const titleKey = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    const yearKey = (item.year || "").trim();
    const key = `${item.type}|${yearKey}|${titleKey}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const typeParam = searchParams.get("type");
  const resolvedType: MediaType | null =
    typeParam === "movie" || typeParam === "series" || typeParam === "anime" || typeParam === "manga" || typeParam === "game"
      ? typeParam
      : null;
  const sources = (searchParams.get("sources")?.split(",") || ["tmdb", "omdb", "mal"]).filter(Boolean) as SearchSource[];

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json({ results: [], errors: ["Too many requests. Please wait."] }, { status: 429 });
  }

  const cacheKey = resolvedType
    ? `${query.trim().toLowerCase()}|type:${resolvedType}`
    : `${query.trim().toLowerCase()}|sources:${sources.sort().join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(
      { results: cached.results, errors: cached.errors, cached: true },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  }

  if (resolvedType) {
    const errors: string[] = [];
    let results: SearchResult[] = [];

    if (resolvedType === "movie" || resolvedType === "series") {
      const tmdb = await searchTMDB(query);
      if (tmdb.error) errors.push(tmdb.error);

      const tmdbMatches = tmdb.results.filter((item) => item.type === resolvedType);

      if (tmdbMatches.length > 0) {
        results = tmdbMatches;
      } else {
        const omdb = await searchOMDB(query);
        if (omdb.error) errors.push(omdb.error);
        results = omdb.results.filter((item) => item.type === resolvedType);
      }

      results = dedupeResults(results);
    } else if (resolvedType === "anime") {
      const response = await searchMALAnime(query);
      results = response.results;
      if (response.error) errors.push(response.error);
    } else if (resolvedType === "manga") {
      const response = await searchMALManga(query);
      results = response.results;
      if (response.error) errors.push(response.error);
    } else if (resolvedType === "game") {
      const response = await searchOMDB(query);
      results = response.results.filter((item) => item.type === "game");
      if (response.error) errors.push(response.error);
    }

    cache.set(cacheKey, { timestamp: Date.now(), results, errors });

    return NextResponse.json(
      { results, errors, cached: false },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  }

  const results: SearchResult[] = [];
  const errors: string[] = [];

  const searchMovieSeries = async () => {
    const res: SearchResult[] = [];
    const errs: string[] = [];
    let found = false;

    if (sources.includes("tmdb")) {
      const tmdb = await searchTMDB(query);
      if (tmdb.error) errs.push(tmdb.error);
      if (tmdb.results.length > 0) {
        res.push(...tmdb.results);
        found = true;
      }
    }

    if (!found && sources.includes("omdb")) {
      const omdb = await searchOMDB(query);
      if (omdb.error) errs.push(omdb.error);
      res.push(...omdb.results);
    }
    return { results: res, errors: errs };
  };

  const searchMal = async () => {
    if (!sources.includes("mal")) return { results: [], errors: [] };
    const mal = await searchMALAnime(query);
    return { results: mal.results, errors: mal.error ? [mal.error] : [] };
  };

  const [movieSeriesData, malData] = await Promise.all([searchMovieSeries(), searchMal()]);

  results.push(...movieSeriesData.results, ...malData.results);
  errors.push(...movieSeriesData.errors, ...malData.errors);

  cache.set(cacheKey, { timestamp: Date.now(), results, errors });

  return NextResponse.json(
    { results, errors, cached: false },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
