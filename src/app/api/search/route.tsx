import { NextResponse } from "next/server";

type MediaType = "movie" | "series" | "anime" | "manga" | "game";

interface SearchResult {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: MediaType;
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

interface IgdbGame {
  id: number;
  name?: string;
  cover?: { url?: string };
  first_release_date?: number;
  summary?: string;
  genres?: Array<{ name?: string }>;
  rating?: number;
  aggregated_rating?: number;
}

const cache = new Map<string, { timestamp: number; results: SearchResult[]; errors: string[] }>();
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const igdbTokenCache = { token: null as string | null, expiresAt: 0 };

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

const normalizeTitle = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const normalizeYear = (value?: string) => (value ? value.trim() : "");

const mergeSearchResult = (primary: SearchResult, secondary: SearchResult): SearchResult => {
  const primaryOverview = primary.overview || "";
  const secondaryOverview = secondary.overview || "";
  return {
    id: primary.id,
    title: primary.title || secondary.title,
    image: primary.image ?? secondary.image,
    year: primary.year || secondary.year,
    type: primary.type,
    overview: primaryOverview.length >= secondaryOverview.length ? primaryOverview : secondaryOverview,
    rating: primary.rating ?? secondary.rating,
  };
};

const mergeMovieSeriesResults = (primary: SearchResult[], secondary: SearchResult[]) => {
  const seen = new Map<string, SearchResult>();
  for (const item of primary) {
    const key = `${item.type}|${normalizeYear(item.year)}|${normalizeTitle(item.title)}`;
    seen.set(key, item);
  }
  for (const item of secondary) {
    const key = `${item.type}|${normalizeYear(item.year)}|${normalizeTitle(item.title)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
    } else {
      seen.set(key, mergeSearchResult(existing, item));
    }
  }
  return Array.from(seen.values());
};

const searchTMDB = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return { results: [] as SearchResult[], error: "Movie/series data provider is not configured." };

  const url = `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  const response = await safeFetchJson(finalUrl, { headers });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { results?: TmdbResult[] };
  const rawResults = payload.results || [];
  const results: SearchResult[] = rawResults
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map((item) => {
      const mediaType: MediaType = item.media_type === "tv" ? "series" : "movie";
      return {
        id: String(item.id),
        title: item.title || item.name || "",
        image: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        year: (item.release_date || item.first_air_date || "").split("-")[0],
        type: mediaType,
        overview: item.overview || "",
        rating: item.vote_average ?? null,
      };
    });

  return { results, error: "" };
};

const searchOMDB = async (query: string, type?: "movie" | "series"): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return { results: [] as SearchResult[], error: "Movie/series data provider is not configured." };

  const typeParam = type ? `&type=${type}` : "";
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}${typeParam}`;
  const response = await safeFetchJson(url);
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };
  const payload = response.data as { Response?: string; Search?: OmdbResult[] };
  if (payload.Response === "False") return { results: [] as SearchResult[], error: "" };

  const rawResults = payload.Search || [];
  const results: SearchResult[] = rawResults
    .filter((item) => item.Type === "movie" || item.Type === "series")
    .map((item) => {
      const mediaType: MediaType = item.Type === "series" ? "series" : "movie";
      return {
        id: item.imdbID,
        title: item.Title,
        image: item.Poster !== "N/A" ? item.Poster : null,
        year: item.Year,
        type: mediaType,
        overview: "",
        rating: null,
      };
    });

  return { results, error: "" };
};

const searchMALAnime = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return { results: [] as SearchResult[], error: "Anime data provider is not configured." };

  const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(query)}&limit=8&fields=title,main_picture,start_date,mean,synopsis`;
  const response = await safeFetchJson(url, { headers: { "X-MAL-CLIENT-ID": clientId } });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];
  const results: SearchResult[] = rawResults.map((item) => {
    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "anime",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
    };
  });

  return { results, error: "" };
};

const searchMALManga = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return { results: [] as SearchResult[], error: "Manga data provider is not configured." };

  const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(query)}&limit=8&fields=title,main_picture,start_date,mean,synopsis`;
  const response = await safeFetchJson(url, { headers: { "X-MAL-CLIENT-ID": clientId } });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];
  const results: SearchResult[] = rawResults.map((item) => {
    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "manga",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
    };
  });

  return { results, error: "" };
};

const formatIgdbCoverUrl = (url?: string) => {
  if (!url) return null;
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return normalized.replace("t_thumb", "t_cover_big");
};

const normalizeIgdbRating = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number((value / 10).toFixed(1));
};

const getIgdbAccessToken = async (): Promise<{ token: string | null; error: string }> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { token: null, error: "Game data provider is not configured." };

  const now = Date.now();
  if (igdbTokenCache.token && igdbTokenCache.expiresAt > now + 60_000) {
    return { token: igdbTokenCache.token, error: "" };
  }

  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
    clientSecret
  )}&grant_type=client_credentials`;
  const response = await safeFetchJson(tokenUrl, { method: "POST" });
  if (!response.ok) return { token: null, error: response.error };
  const payload = response.data as { access_token?: string; expires_in?: number };
  if (!payload.access_token || typeof payload.expires_in !== "number") {
    return { token: null, error: "Game data provider authentication failed." };
  }

  igdbTokenCache.token = payload.access_token;
  igdbTokenCache.expiresAt = now + payload.expires_in * 1000;
  return { token: payload.access_token, error: "" };
};

const searchIGDBGames = async (query: string): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const tokenResult = await getIgdbAccessToken();
  if (!clientId || !tokenResult.token) return { results: [] as SearchResult[], error: tokenResult.error };

  const sanitized = query.replace(/"/g, "").trim();
  const body = `search "${sanitized}"; fields id,name,cover.url,first_release_date,summary,genres.name,aggregated_rating,rating; limit 20;`;
  const response = await safeFetchJson("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!response.ok) return { results: [] as SearchResult[], error: response.error };

  const payload = response.data as IgdbGame[];
  const results: SearchResult[] = (payload || []).map((item) => {
    const year = item.first_release_date ? String(new Date(item.first_release_date * 1000).getUTCFullYear()) : "";
    const ratingValue = normalizeIgdbRating(item.aggregated_rating ?? item.rating);
    return {
      id: String(item.id),
      title: item.name || "",
      image: formatIgdbCoverUrl(item.cover?.url),
      year,
      type: "game",
      overview: item.summary || "",
      rating: ratingValue,
    };
  });

  return { results, error: "" };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const typeParam = searchParams.get("type");
  const resolvedType: MediaType | null =
    typeParam === "movie" || typeParam === "series" || typeParam === "anime" || typeParam === "manga" || typeParam === "game"
      ? typeParam
      : null;

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json({ results: [], errors: ["Too many requests. Please wait."] }, { status: 429 });
  }

  const cacheKey = resolvedType ? `${query.toLowerCase()}|type:${resolvedType}` : `${query.toLowerCase()}|all`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(
      { results: cached.results, errors: cached.errors, cached: true },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
    );
  }

  const errors: string[] = [];
  let results: SearchResult[] = [];

  if (resolvedType) {
    if (resolvedType === "movie" || resolvedType === "series") {
      const [tmdb, omdb] = await Promise.all([searchTMDB(query), searchOMDB(query, resolvedType)]);
      if (tmdb.error) errors.push(tmdb.error);
      if (omdb.error) errors.push(omdb.error);
      const tmdbMatches = tmdb.results.filter((item) => item.type === resolvedType);
      const omdbMatches = omdb.results.filter((item) => item.type === resolvedType);
      results = mergeMovieSeriesResults(tmdbMatches, omdbMatches);
    } else if (resolvedType === "anime") {
      const response = await searchMALAnime(query);
      results = response.results;
      if (response.error) errors.push(response.error);
    } else if (resolvedType === "manga") {
      const response = await searchMALManga(query);
      results = response.results;
      if (response.error) errors.push(response.error);
    } else if (resolvedType === "game") {
      const response = await searchIGDBGames(query);
      results = response.results;
      if (response.error) errors.push(response.error);
    }
  } else {
    const [tmdb, omdb, anime, manga, games] = await Promise.all([
      searchTMDB(query),
      searchOMDB(query),
      searchMALAnime(query),
      searchMALManga(query),
      searchIGDBGames(query),
    ]);

    if (tmdb.error) errors.push(tmdb.error);
    if (omdb.error) errors.push(omdb.error);
    if (anime.error) errors.push(anime.error);
    if (manga.error) errors.push(manga.error);
    if (games.error) errors.push(games.error);

    const mergedMovieSeries = mergeMovieSeriesResults(tmdb.results, omdb.results);
    results = [...mergedMovieSeries, ...anime.results, ...manga.results, ...games.results];
  }

  cache.set(cacheKey, { timestamp: Date.now(), results, errors });

  return NextResponse.json(
    { results, errors, cached: false },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } }
  );
}
