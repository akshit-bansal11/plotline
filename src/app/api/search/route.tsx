import { NextResponse } from "next/server";
import {
  type ApiBaseType,
  type ApiSearchStatus,
  type ApiSearchType,
  getBaseTypeFromSearchType,
  normalizeGamePlatform,
  normalizeGenreName,
  normalizeSerializationName,
  normalizeStatusName,
  normalizeStudioName,
  normalizeSubtype,
} from "@/utils/searchFilters";

type MediaType = ApiBaseType;

interface SearchResult {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: MediaType;
  overview?: string;
  rating?: number | null;
  genres?: string[];
  subtype?: string | null;
  status?: ApiSearchStatus | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  studio?: string | null;
  platforms?: string[];
  serialization?: string | null;
  lengthMinutes?: number | null;
}

interface SearchFilters {
  searchType: ApiSearchType | null;
  baseType: ApiBaseType | null;
  subtype: string | null;
  genres: Set<string>;
  yearMin: number | null;
  yearMax: number | null;
  ratingMin: number | null;
  episodeMin: number | null;
  chapterMin: number | null;
  status: ApiSearchStatus | null;
  studio: string | null;
  platform: string | null;
  serialization: string | null;
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
  genre_ids?: number[];
}

interface TmdbDetail {
  status?: string;
  runtime?: number;
  episode_run_time?: number[];
  number_of_episodes?: number;
  genres?: Array<{ id?: number; name?: string }>;
}

interface OmdbResult {
  imdbID: string;
  Title: string;
  Poster: string;
  Year: string;
  Type: string;
}

interface OmdbDetail {
  Genre?: string;
  imdbRating?: string;
  Runtime?: string;
}

interface MalNode {
  id: number;
  title: string;
  main_picture?: { medium?: string };
  start_date?: string;
  synopsis?: string;
  mean?: number;
  media_type?: string;
  status?: string;
  num_episodes?: number;
  num_chapters?: number;
  genres?: Array<{ name?: string }>;
  studios?: Array<{ name?: string }>;
  serialization?: Array<{ name?: string } | { node?: { name?: string } }>;
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
  platforms?: Array<{ name?: string }>;
  rating?: number;
  aggregated_rating?: number;
  total_rating?: number;
}

const cache = new Map<
  string,
  { timestamp: number; results: SearchResult[]; errors: string[] }
>();
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const igdbTokenCache = { token: null as string | null, expiresAt: 0 };

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;
const CACHE_TTL = 1000 * 60 * 5;

const TMDB_MOVIE_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  35: "Comedy",
  18: "Drama",
  14: "Fantasy",
  27: "Horror",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  53: "Thriller",
};

const TMDB_TV_GENRE_MAP: Record<number, string> = {
  10759: "Action",
  16: "Adventure",
  35: "Comedy",
  18: "Drama",
  10765: "Sci-Fi",
  9648: "Mystery",
  10768: "Thriller",
};

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

const safeFetchJson = async (
  url: string,
  init?: RequestInit,
): Promise<FetchResult> => {
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

const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();
const normalizeYearKey = (value?: string) => (value ? value.trim() : "");

const parseYearNumber = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/\d{4}/);
  if (!match) return null;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseNumberParam = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseFilterParams = (searchParams: URLSearchParams): SearchFilters => {
  const rawType = searchParams.get("type");
  const searchType: ApiSearchType | null =
    rawType === "movie" ||
    rawType === "series" ||
    rawType === "anime" ||
    rawType === "anime_movie" ||
    rawType === "manga" ||
    rawType === "game"
      ? rawType
      : null;

  const baseType = getBaseTypeFromSearchType(searchType);
  const explicitSubtype = baseType
    ? normalizeSubtype(baseType, searchParams.get("subtype"))
    : null;
  const subtype = searchType === "anime_movie" ? "movie" : explicitSubtype;

  const genreSet = new Set<string>();
  const genreParam = searchParams.get("genres");
  if (genreParam) {
    genreParam
      .split(",")
      .map((item) => normalizeGenreName(item))
      .forEach((item) => {
        if (item) genreSet.add(item);
      });
  }

  const rawStatus = searchParams.get("status");
  const status: ApiSearchStatus | null =
    rawStatus === "finished" ||
    rawStatus === "airing" ||
    rawStatus === "tba" ||
    rawStatus === "not_yet_aired"
      ? rawStatus
      : null;

  const studio = normalizeStudioName(searchParams.get("studio"));
  const platform = normalizeGamePlatform(searchParams.get("platform"));
  const serialization = normalizeSerializationName(
    searchParams.get("serialization"),
  );

  return {
    searchType,
    baseType,
    subtype,
    genres: genreSet,
    yearMin: parseNumberParam(searchParams.get("yearMin")),
    yearMax: parseNumberParam(searchParams.get("yearMax")),
    ratingMin: parseNumberParam(searchParams.get("ratingMin")),
    episodeMin: parseNumberParam(searchParams.get("episodeMin")),
    chapterMin: parseNumberParam(searchParams.get("chapterMin")),
    status,
    studio,
    platform,
    serialization,
  };
};

const normalizeGenres = (genres: Array<string | null | undefined>) => {
  const set = new Set<string>();
  genres.forEach((genre) => {
    const normalized = normalizeGenreName(genre);
    if (normalized) set.add(normalized);
  });
  return Array.from(set);
};

const parseRuntimeMinutes = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const resolveSubtype = (
  type: MediaType,
  subtype: string | null,
  lengthMinutes: number | null,
) => {
  if (type === "movie") {
    if (subtype) return subtype;
    if (
      typeof lengthMinutes === "number" &&
      lengthMinutes > 0 &&
      lengthMinutes <= 45
    )
      return "short_movie";
  }
  return subtype;
};

const mergeSearchResult = (
  primary: SearchResult,
  secondary: SearchResult,
): SearchResult => {
  const primaryOverview = primary.overview || "";
  const secondaryOverview = secondary.overview || "";

  const mergedGenres = Array.from(
    new Set([...(primary.genres || []), ...(secondary.genres || [])]),
  );
  const mergedPlatforms = Array.from(
    new Set([...(primary.platforms || []), ...(secondary.platforms || [])]),
  );

  const mergedLength = primary.lengthMinutes ?? secondary.lengthMinutes ?? null;

  return {
    ...primary,
    title: primary.title || secondary.title,
    image: primary.image ?? secondary.image,
    year: primary.year || secondary.year,
    overview:
      primaryOverview.length >= secondaryOverview.length
        ? primaryOverview
        : secondaryOverview,
    rating: primary.rating ?? secondary.rating ?? null,
    genres: mergedGenres,
    subtype: resolveSubtype(
      primary.type,
      primary.subtype ?? secondary.subtype ?? null,
      mergedLength,
    ),
    status: primary.status ?? secondary.status ?? null,
    episodeCount: primary.episodeCount ?? secondary.episodeCount ?? null,
    chapterCount: primary.chapterCount ?? secondary.chapterCount ?? null,
    studio: primary.studio ?? secondary.studio ?? null,
    platforms: mergedPlatforms,
    serialization: primary.serialization ?? secondary.serialization ?? null,
    lengthMinutes: mergedLength,
  };
};

const mergeMovieSeriesResults = (
  primary: SearchResult[],
  secondary: SearchResult[],
) => {
  const seen = new Map<string, SearchResult>();

  for (const item of primary) {
    const key = `${item.type}|${normalizeYearKey(item.year)}|${normalizeTitle(item.title)}`;
    seen.set(key, item);
  }

  for (const item of secondary) {
    const key = `${item.type}|${normalizeYearKey(item.year)}|${normalizeTitle(item.title)}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    seen.set(key, mergeSearchResult(existing, item));
  }

  return Array.from(seen.values());
};

const buildTmdbUrl = (path: string) => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) {
    return {
      url: null,
      headers: undefined as Record<string, string> | undefined,
    };
  }

  const headers = bearerToken
    ? { Authorization: `Bearer ${bearerToken}` }
    : undefined;
  if (bearerToken) {
    return { url: `https://api.themoviedb.org/3${path}`, headers };
  }

  const separator = path.includes("?") ? "&" : "?";
  return {
    url: `https://api.themoviedb.org/3${path}${separator}api_key=${apiKey}`,
    headers,
  };
};

const mapTmdbGenreIds = (ids: number[] | undefined, type: "movie" | "tv") => {
  if (!ids || ids.length === 0) return [];
  const map = type === "tv" ? TMDB_TV_GENRE_MAP : TMDB_MOVIE_GENRE_MAP;
  return normalizeGenres(ids.map((id) => map[id] || null));
};

const fetchTmdbDetails = async (id: number, type: "movie" | "tv") => {
  const tmdbPath = `/${type}/${id}?language=en-US`;
  const endpoint = buildTmdbUrl(tmdbPath);
  if (!endpoint.url) {
    return null;
  }

  const response = await safeFetchJson(endpoint.url, {
    headers: endpoint.headers,
  });
  if (!response.ok) return null;

  const payload = response.data as TmdbDetail;
  const genres = normalizeGenres(
    (payload.genres || [])
      .map((genre) => genre.name)
      .filter((genre): genre is string => Boolean(genre)),
  );

  const runtime = typeof payload.runtime === "number" ? payload.runtime : null;
  const episodeRuntime =
    Array.isArray(payload.episode_run_time) &&
    payload.episode_run_time.length > 0
      ? payload.episode_run_time[0] || null
      : null;

  return {
    status: normalizeStatusName(payload.status),
    episodeCount:
      typeof payload.number_of_episodes === "number"
        ? payload.number_of_episodes
        : null,
    lengthMinutes: type === "movie" ? runtime : episodeRuntime,
    genres,
  };
};

const searchTMDB = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const endpoint = buildTmdbUrl(
    `/search/multi?query=${encodeURIComponent(queryValue)}&include_adult=false`,
  );
  if (!endpoint.url) {
    return {
      results: [],
      error: "Movie/series data provider is not configured.",
    };
  }

  const response = await safeFetchJson(endpoint.url, {
    headers: endpoint.headers,
  });
  if (!response.ok) {
    return { results: [], error: response.error };
  }

  const payload = response.data as { results?: TmdbResult[] };
  const rawResults = (payload.results || [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 12);

  const detailPayloads = await Promise.all(
    rawResults.map((item) =>
      fetchTmdbDetails(item.id, item.media_type === "tv" ? "tv" : "movie"),
    ),
  );

  const results: SearchResult[] = rawResults.map((item, index) => {
    const type: MediaType = item.media_type === "tv" ? "series" : "movie";
    const detail = detailPayloads[index];
    const baseGenres = mapTmdbGenreIds(
      item.genre_ids,
      item.media_type === "tv" ? "tv" : "movie",
    );
    const mergedGenres = Array.from(
      new Set([...baseGenres, ...(detail?.genres || [])]),
    );

    const base: SearchResult = {
      id: String(item.id),
      title: item.title || item.name || "",
      image: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null,
      year: (item.release_date || item.first_air_date || "").split("-")[0],
      type,
      overview: item.overview || "",
      rating: item.vote_average ?? null,
      genres: mergedGenres,
      status: detail?.status ?? null,
      episodeCount: detail?.episodeCount ?? null,
      lengthMinutes: detail?.lengthMinutes ?? null,
    };

    return {
      ...base,
      subtype: resolveSubtype(type, null, base.lengthMinutes ?? null),
    };
  });

  return { results, error: "" };
};

const fetchOmdbDetails = async (
  imdbID: string,
  apiKey: string,
): Promise<OmdbDetail | null> => {
  const response = await safeFetchJson(
    `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(imdbID)}&plot=short`,
  );
  if (!response.ok) return null;
  const payload = response.data as OmdbDetail & { Response?: string };
  if (payload.Response === "False") return null;
  return payload;
};

const searchOMDB = async (
  queryValue: string,
  type?: "movie" | "series",
): Promise<{ results: SearchResult[]; error: string }> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    return {
      results: [],
      error: "Movie/series data provider is not configured.",
    };
  }

  const typeParam = type ? `&type=${type}` : "";
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(queryValue)}${typeParam}`;
  const response = await safeFetchJson(url);
  if (!response.ok) {
    return { results: [], error: response.error };
  }

  const payload = response.data as { Response?: string; Search?: OmdbResult[] };
  if (payload.Response === "False") {
    return { results: [], error: "" };
  }

  const rawResults = (payload.Search || [])
    .filter((item) => item.Type === "movie" || item.Type === "series")
    .slice(0, 12);

  const details = await Promise.all(
    rawResults.map((item) => fetchOmdbDetails(item.imdbID, apiKey)),
  );

  const results: SearchResult[] = rawResults.map((item, index) => {
    const resultType: MediaType = item.Type === "series" ? "series" : "movie";
    const detail = details[index];
    const rating =
      detail?.imdbRating && detail.imdbRating !== "N/A"
        ? Number(detail.imdbRating)
        : null;
    const lengthMinutes = parseRuntimeMinutes(detail?.Runtime || null);
    const genres = normalizeGenres(
      (detail?.Genre || "").split(",").map((part) => part.trim()),
    );

    const base: SearchResult = {
      id: item.imdbID,
      title: item.Title,
      image: item.Poster !== "N/A" ? item.Poster : null,
      year: item.Year,
      type: resultType,
      overview: "",
      rating:
        typeof rating === "number" && Number.isFinite(rating) ? rating : null,
      genres,
      lengthMinutes,
    };

    return {
      ...base,
      subtype: resolveSubtype(resultType, null, lengthMinutes),
    };
  });

  return { results, error: "" };
};

const extractMalSerialization = (value: MalNode["serialization"]) => {
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    if (entry && typeof entry === "object") {
      const directName =
        "name" in entry ? (entry as { name?: string }).name : null;
      const nestedName =
        "node" in entry
          ? (entry as { node?: { name?: string } }).node?.name
          : null;
      const normalized = normalizeSerializationName(
        directName || nestedName || null,
      );
      if (normalized) return normalized;
    }
  }

  return null;
};

const searchMALAnime = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return { results: [], error: "Anime data provider is not configured." };
  }

  const fields =
    "title,main_picture,start_date,mean,synopsis,media_type,status,num_episodes,genres,studios";
  const url = `https://api.myanimelist.net/v2/anime?q=${encodeURIComponent(queryValue)}&limit=12&fields=${fields}`;
  const response = await safeFetchJson(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  if (!response.ok) {
    return { results: [], error: response.error };
  }

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];

  const results: SearchResult[] = rawResults.map((item) => {
    const genres = normalizeGenres(
      (item.node.genres || []).map((genre) => genre.name),
    );
    const studioCandidates = (item.node.studios || [])
      .map((candidate) => normalizeStudioName(candidate.name))
      .filter((candidate): candidate is NonNullable<typeof candidate> =>
        Boolean(candidate),
      );
    const studio = studioCandidates[0] || null;
    const subtype = normalizeSubtype("anime", item.node.media_type);

    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "anime",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
      genres,
      subtype,
      status: normalizeStatusName(item.node.status),
      episodeCount:
        typeof item.node.num_episodes === "number"
          ? item.node.num_episodes
          : null,
      studio,
    };
  });

  return { results, error: "" };
};

const searchMALManga = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    return { results: [], error: "Manga data provider is not configured." };
  }

  const fields =
    "title,main_picture,start_date,mean,synopsis,media_type,status,num_chapters,genres,serialization";
  const url = `https://api.myanimelist.net/v2/manga?q=${encodeURIComponent(queryValue)}&limit=12&fields=${fields}`;
  const response = await safeFetchJson(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  if (!response.ok) {
    return { results: [], error: response.error };
  }

  const payload = response.data as { data?: MalItem[] };
  const rawResults = payload.data || [];

  const results: SearchResult[] = rawResults.map((item) => {
    const genres = normalizeGenres(
      (item.node.genres || []).map((genre) => genre.name),
    );

    return {
      id: String(item.node.id),
      title: item.node.title,
      image: item.node.main_picture?.medium || null,
      year: item.node.start_date ? item.node.start_date.split("-")[0] : "",
      type: "manga",
      overview: item.node.synopsis || "",
      rating: item.node.mean ?? null,
      genres,
      subtype: normalizeSubtype("manga", item.node.media_type),
      status: normalizeStatusName(item.node.status),
      chapterCount:
        typeof item.node.num_chapters === "number"
          ? item.node.num_chapters
          : null,
      serialization: extractMalSerialization(item.node.serialization),
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

const getIgdbAccessToken = async (): Promise<{
  token: string | null;
  error: string;
}> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { token: null, error: "Game data provider is not configured." };
  }

  const now = Date.now();
  if (igdbTokenCache.token && igdbTokenCache.expiresAt > now + 60_000) {
    return { token: igdbTokenCache.token, error: "" };
  }

  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
    clientSecret,
  )}&grant_type=client_credentials`;
  const response = await safeFetchJson(tokenUrl, { method: "POST" });
  if (!response.ok) {
    return { token: null, error: response.error };
  }

  const payload = response.data as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token || typeof payload.expires_in !== "number") {
    return { token: null, error: "Game data provider authentication failed." };
  }

  igdbTokenCache.token = payload.access_token;
  igdbTokenCache.expiresAt = now + payload.expires_in * 1000;

  return { token: payload.access_token, error: "" };
};

const searchIGDBGames = async (
  queryValue: string,
): Promise<{ results: SearchResult[]; error: string }> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const tokenResult = await getIgdbAccessToken();
  if (!clientId || !tokenResult.token) {
    return { results: [], error: tokenResult.error };
  }

  const sanitized = queryValue.replace(/"/g, "").trim();
  const body = `search "${sanitized}"; fields id,name,cover.url,first_release_date,summary,genres.name,platforms.name,aggregated_rating,rating,total_rating; limit 20;`;
  const response = await safeFetchJson("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!response.ok) {
    return { results: [], error: response.error };
  }

  const payload = response.data as IgdbGame[];

  const results: SearchResult[] = (payload || []).map((item) => {
    const year = item.first_release_date
      ? String(new Date(item.first_release_date * 1000).getUTCFullYear())
      : "";
    const ratingValue = normalizeIgdbRating(
      item.aggregated_rating ?? item.total_rating ?? item.rating,
    );
    const genres = normalizeGenres(
      (item.genres || []).map((genre) => genre.name),
    );
    const normalizedPlatforms = (item.platforms || [])
      .map((platform) => normalizeGamePlatform(platform.name))
      .filter((platform): platform is NonNullable<typeof platform> =>
        Boolean(platform),
      );
    const platforms = Array.from(new Set(normalizedPlatforms));

    return {
      id: String(item.id),
      title: item.name || "",
      image: formatIgdbCoverUrl(item.cover?.url),
      year,
      type: "game",
      overview: item.summary || "",
      rating: ratingValue,
      genres,
      platforms,
    };
  });

  return { results, error: "" };
};

const itemMatchesFilters = (item: SearchResult, filters: SearchFilters) => {
  if (filters.searchType) {
    if (filters.searchType === "anime_movie") {
      if (!(item.type === "anime" && item.subtype === "movie")) return false;
    } else if (item.type !== filters.searchType) {
      return false;
    }
  }

  if (filters.subtype && item.subtype !== filters.subtype) {
    return false;
  }

  if (filters.genres.size > 0) {
    const itemGenres = new Set(item.genres || []);
    const hasAny = Array.from(filters.genres).some((genre) =>
      itemGenres.has(genre),
    );
    if (!hasAny) return false;
  }

  const year = parseYearNumber(item.year);
  if (
    typeof filters.yearMin === "number" &&
    (!year || year < filters.yearMin)
  ) {
    return false;
  }
  if (
    typeof filters.yearMax === "number" &&
    (!year || year > filters.yearMax)
  ) {
    return false;
  }

  if (typeof filters.ratingMin === "number") {
    if (typeof item.rating !== "number" || item.rating < filters.ratingMin)
      return false;
  }

  if (typeof filters.episodeMin === "number") {
    if (
      typeof item.episodeCount !== "number" ||
      item.episodeCount < filters.episodeMin
    )
      return false;
  }

  if (typeof filters.chapterMin === "number") {
    if (
      typeof item.chapterCount !== "number" ||
      item.chapterCount < filters.chapterMin
    )
      return false;
  }

  if (filters.status && item.status !== filters.status) {
    return false;
  }

  if (filters.studio) {
    if (!item.studio || normalizeStudioName(item.studio) !== filters.studio)
      return false;
  }

  if (filters.platform) {
    if (!item.platforms?.includes(filters.platform)) return false;
  }

  if (filters.serialization) {
    if (
      !item.serialization ||
      normalizeSerializationName(item.serialization) !== filters.serialization
    )
      return false;
  }

  return true;
};

const applyFilters = (results: SearchResult[], filters: SearchFilters) => {
  if (
    !filters.searchType &&
    !filters.subtype &&
    filters.genres.size === 0 &&
    filters.yearMin === null &&
    filters.yearMax === null &&
    filters.ratingMin === null &&
    filters.episodeMin === null &&
    filters.chapterMin === null &&
    !filters.status &&
    !filters.studio &&
    !filters.platform &&
    !filters.serialization
  ) {
    return results;
  }

  return results.filter((item) => itemMatchesFilters(item, filters));
};

const sanitizeResult = (item: SearchResult): SearchResult => {
  const genres = Array.from(new Set(item.genres || []));
  const platforms = Array.from(new Set(item.platforms || []));
  const normalizedStudio = normalizeStudioName(item.studio || null);

  return {
    ...item,
    genres,
    platforms,
    studio: normalizedStudio || item.studio || null,
    serialization:
      normalizeSerializationName(item.serialization || null) ||
      item.serialization ||
      null,
    status: item.status || null,
    subtype: resolveSubtype(
      item.type,
      item.subtype || null,
      item.lengthMinutes ?? null,
    ),
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryValue = searchParams.get("q")?.trim();

  if (!queryValue) {
    return NextResponse.json({ results: [] });
  }

  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json(
      { results: [], errors: ["Too many requests. Please wait."] },
      { status: 429 },
    );
  }

  const filters = parseFilterParams(searchParams);
  const cacheKey = searchParams.toString().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(
      { results: cached.results, errors: cached.errors, cached: true },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  }

  const errors: string[] = [];
  let results: SearchResult[] = [];

  if (filters.baseType) {
    if (filters.baseType === "movie" || filters.baseType === "series") {
      const [tmdb, omdb] = await Promise.all([
        searchTMDB(queryValue),
        searchOMDB(
          queryValue,
          filters.baseType === "movie" ? "movie" : "series",
        ),
      ]);
      if (tmdb.error) errors.push(tmdb.error);
      if (omdb.error) errors.push(omdb.error);

      const tmdbMatches = tmdb.results.filter(
        (item) => item.type === filters.baseType,
      );
      const omdbMatches = omdb.results.filter(
        (item) => item.type === filters.baseType,
      );
      results = mergeMovieSeriesResults(tmdbMatches, omdbMatches);
    } else if (filters.baseType === "anime") {
      const anime = await searchMALAnime(queryValue);
      results = anime.results;
      if (anime.error) errors.push(anime.error);
    } else if (filters.baseType === "manga") {
      const manga = await searchMALManga(queryValue);
      results = manga.results;
      if (manga.error) errors.push(manga.error);
    } else if (filters.baseType === "game") {
      const games = await searchIGDBGames(queryValue);
      results = games.results;
      if (games.error) errors.push(games.error);
    }
  } else {
    const [tmdb, omdb, anime, manga, games] = await Promise.all([
      searchTMDB(queryValue),
      searchOMDB(queryValue),
      searchMALAnime(queryValue),
      searchMALManga(queryValue),
      searchIGDBGames(queryValue),
    ]);

    if (tmdb.error) errors.push(tmdb.error);
    if (omdb.error) errors.push(omdb.error);
    if (anime.error) errors.push(anime.error);
    if (manga.error) errors.push(manga.error);
    if (games.error) errors.push(games.error);

    const mergedMovieSeries = mergeMovieSeriesResults(
      tmdb.results,
      omdb.results,
    );
    results = [
      ...mergedMovieSeries,
      ...anime.results,
      ...manga.results,
      ...games.results,
    ];
  }

  const sanitized = results.map((item) => sanitizeResult(item));
  const filtered = applyFilters(sanitized, filters).slice(0, 30);

  cache.set(cacheKey, { timestamp: Date.now(), results: filtered, errors });

  return NextResponse.json(
    { results: filtered, errors, cached: false },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
