import { NextResponse } from "next/server";

type MediaType = "movie" | "series" | "anime" | "manga" | "game";

type MetadataResult = {
  title?: string;
  description?: string;
  year?: string;
  type?: MediaType;
  image?: string | null;
  rating?: number | null;
  tmdbRating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
  genreIds?: number[];
  cast?: string[];
  director?: string | null;
  producer?: string | null;
};

type FetchResult = { ok: true; data: unknown } | { ok: false; error: string };

const cache = new Map<string, { timestamp: number; data: MetadataResult | null }>();
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const igdbTokenCache = { token: null as string | null, expiresAt: 0 };
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 60;
const CACHE_TTL = 1000 * 60 * 5;
const FETCH_RETRY_COUNT = 2;
const FETCH_RETRY_DELAY_MS = 250;

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

const safeFetchJson = async (url: string, init?: RequestInit): Promise<FetchResult> => {
  const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
  for (let attempt = 0; attempt <= FETCH_RETRY_COUNT; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (res.ok) {
        const data = await res.json();
        return { ok: true, data };
      }
      const error = `Request failed with status ${res.status}`;
      const shouldRetry = res.status === 429 || res.status >= 500;
      if (shouldRetry && attempt < FETCH_RETRY_COUNT) {
        await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.warn("[metadata] fetch failed", { url, error });
      return { ok: false, error };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      if (attempt < FETCH_RETRY_COUNT) {
        await sleep(FETCH_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.warn("[metadata] fetch failed", { url, error: message });
      return { ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }
  return { ok: false, error: "Request failed" };
};

const parseYear = (value?: string | null) => (value ? value.split("-")[0] : undefined);

const parseRuntimeMinutes = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
};

const parseOmdbYear = (value?: string | null) => {
  if (!value) return undefined;
  const match = value.match(/\d{4}/);
  return match ? match[0] : undefined;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

const isValidNumber = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value);

const getMissingFields = (data: MetadataResult | null, mediaType: MediaType) => {
  const required =
    mediaType === "movie"
      ? [
          "title",
          "type",
          "lengthMinutes",
          "year",
          "rating",
          "genresThemes",
          "genreIds",
          "description",
        ]
      : [
          "title",
          "type",
          "episodeCount",
          "year",
          "rating",
          "genresThemes",
          "genreIds",
          "description",
        ];
  if (!data) return required;
  const missing: string[] = [];
  if (!data.title || data.title.trim().length === 0) missing.push("title");
  if (!data.type || data.type !== mediaType) missing.push("type");
  if (!data.description || data.description.trim().length === 0) missing.push("description");
  if (!data.year || data.year.trim().length === 0) missing.push("year");
  if (!isValidNumber(data.rating)) missing.push("rating");
  if (!Array.isArray(data.genresThemes) || data.genresThemes.length === 0)
    missing.push("genresThemes");
  if (!Array.isArray(data.genreIds) || data.genreIds.length === 0) missing.push("genreIds");
  if (mediaType === "movie") {
    if (!isValidNumber(data.lengthMinutes) || (data.lengthMinutes ?? 0) <= 0)
      missing.push("lengthMinutes");
  } else {
    if (!isValidNumber(data.episodeCount) || (data.episodeCount ?? 0) <= 0)
      missing.push("episodeCount");
  }
  return missing;
};

const logMissingFields = (
  source: string,
  data: MetadataResult | null,
  mediaType: MediaType,
  context: { id?: string | null; title?: string | null; year?: string | null },
) => {
  const missing = getMissingFields(data, mediaType);
  if (missing.length === 0) return;
  console.warn("[metadata] missing fields", {
    source,
    mediaType,
    id: context.id || null,
    title: context.title || null,
    year: context.year || null,
    missing,
  });
};

const mergeMetadata = (
  primary: MetadataResult | null,
  secondary: MetadataResult | null,
): MetadataResult | null => {
  if (!primary && !secondary) return null;
  console.log("[metadata] merging", {
    primaryTitle: primary?.title,
    secondaryTitle: secondary?.title,
    primaryDirector: primary?.director,
    secondaryDirector: secondary?.director,
  });
  if (!primary) return secondary;
  if (!secondary) return primary;
  const primaryDesc = primary.description || "";
  const secondaryDesc = secondary.description || "";
  const genres = Array.from(
    new Set([...(primary.genresThemes || []), ...(secondary.genresThemes || [])]),
  );
  const genreIds = Array.from(
    new Set([...(primary.genreIds || []), ...(secondary.genreIds || [])]),
  );
  const cast = Array.from(new Set([...(primary.cast || []), ...(secondary.cast || [])])).slice(
    0,
    10,
  );

  return {
    title: primary.title || secondary.title,
    description: primaryDesc.length >= secondaryDesc.length ? primaryDesc : secondaryDesc,
    year: primary.year || secondary.year,
    type: primary.type || secondary.type,
    image: primary.image ?? secondary.image,
    rating:
      typeof primary.rating === "number"
        ? typeof secondary.rating === "number"
          ? Math.max(primary.rating, secondary.rating)
          : primary.rating
        : (secondary.rating ?? null),
    tmdbRating: primary.tmdbRating ?? secondary.tmdbRating ?? null,
    imdbRating: primary.imdbRating ?? secondary.imdbRating ?? null,
    lengthMinutes: primary.lengthMinutes ?? secondary.lengthMinutes ?? null,
    episodeCount: primary.episodeCount ?? secondary.episodeCount ?? null,
    chapterCount: primary.chapterCount ?? secondary.chapterCount ?? null,
    genresThemes: genres,
    genreIds,
    cast,
    director: primary.director || secondary.director || null,
    producer: primary.producer || secondary.producer || null,
  };
};

const searchTmdbIdByTitle = async (
  title: string,
  mediaType: MediaType,
  year?: string | null,
): Promise<string | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return null;
  if (mediaType !== "movie" && mediaType !== "series") return null;

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const yearParam = year?.trim()
    ? mediaType === "movie"
      ? `&year=${encodeURIComponent(year)}`
      : `&first_air_date_year=${encodeURIComponent(year)}`
    : "";
  const url = `https://api.themoviedb.org/3/search/${tmdbType}?query=${encodeURIComponent(title)}${yearParam}`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  const response = await safeFetchJson(finalUrl, { headers });
  if (!response.ok) return null;
  const payload = response.data as { results?: Array<{ id?: number }> };
  const match = payload.results?.[0];
  return match?.id ? String(match.id) : null;
};

const fetchTmdbCredits = async (
  id: string,
  mediaType: MediaType,
): Promise<{ cast: string[]; director: string | null }> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return { cast: [], director: null };
  if (mediaType !== "movie" && mediaType !== "series") return { cast: [], director: null };

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${tmdbType}/${encodeURIComponent(id)}/credits?language=en-US`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  const response = await safeFetchJson(finalUrl, { headers });
  if (!response.ok) return { cast: [], director: null };

  const data = response.data as {
    cast?: Array<{ name?: string }>;
    crew?: Array<{ name?: string; job?: string }>;
  };

  const cast = Array.isArray(data.cast)
    ? data.cast
        .slice(0, 5)
        .map((c) => c.name)
        .filter((v): v is string => Boolean(v))
    : [];

  let director = null;
  if (Array.isArray(data.crew)) {
    const d = data.crew.find((c) => c.job === "Director");
    if (d?.name) director = d.name;
    else if (mediaType === "series") {
      // For TV, often "Executive Producer" or "Creator" is used as a proxy, but let's stick to Director
      const creator = data.crew.find((c) => c.job === "Executive Producer");
      if (creator?.name) director = creator.name;
    }
  }

  return { cast, director };
};

const fetchTmdbMetadataById = async (
  id: string,
  mediaType: MediaType,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.TMDB_API_KEY;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearerToken) return null;
  if (mediaType !== "movie" && mediaType !== "series") return null;

  const tmdbType = mediaType === "series" ? "tv" : "movie";
  const url = `https://api.themoviedb.org/3/${tmdbType}/${encodeURIComponent(id)}?language=en-US`;
  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const finalUrl = bearerToken ? url : `${url}&api_key=${apiKey}`;
  const [detailsRes, credits] = await Promise.all([
    safeFetchJson(finalUrl, { headers }),
    fetchTmdbCredits(id, mediaType),
  ]);

  if (!detailsRes.ok) return null;
  const data = detailsRes.data as {
    title?: string;
    name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    episode_run_time?: number[];
    number_of_episodes?: number;
    poster_path?: string | null;
    vote_average?: number;
    genres?: Array<{ id?: number; name?: string }>;
    production_companies?: Array<{ name?: string }>;
  };

  const lengthMinutes =
    mediaType === "movie"
      ? typeof data.runtime === "number"
        ? data.runtime
        : null
      : Array.isArray(data.episode_run_time) && data.episode_run_time.length > 0
        ? (data.episode_run_time[0] ?? null)
        : null;

  return {
    title: data.title || data.name,
    description: data.overview || "",
    year: parseYear(mediaType === "movie" ? data.release_date : data.first_air_date),
    type: mediaType,
    image: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
    rating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    tmdbRating: typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    lengthMinutes,
    episodeCount:
      mediaType === "series" && typeof data.number_of_episodes === "number"
        ? data.number_of_episodes
        : null,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    genreIds: Array.isArray(data.genres)
      ? data.genres
          .map((g) => g.id)
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
      : [],
    cast: credits.cast,
    director: credits.director,
    producer: Array.isArray(data.production_companies) ? data.production_companies[0]?.name : null,
  };
};

const fetchTmdbMetadata = async (
  id: string | null,
  title: string | null,
  mediaType: MediaType,
  year?: string | null,
) => {
  if (mediaType !== "movie" && mediaType !== "series") return null;
  const resolvedId =
    id && /^\d+$/.test(id) ? id : title ? await searchTmdbIdByTitle(title, mediaType, year) : null;
  if (!resolvedId) return null;
  return fetchTmdbMetadataById(resolvedId, mediaType);
};

const fetchOmdbMetadataById = async (
  id: string,
  mediaType: MediaType,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(id)}&plot=full`;
  const response = await safeFetchJson(url);
  if (!response.ok) return null;
  const data = response.data as {
    Response?: string;
    Title?: string;
    Year?: string;
    Plot?: string;
    Runtime?: string;
    Genre?: string;
    Actors?: string;
    Poster?: string;
    imdbRating?: string;
    Director?: string;
    Production?: string;
    Writer?: string;
  };
  if (data.Response === "False") return null;

  const rating = data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
  const ratingRounded =
    typeof rating === "number" && Number.isFinite(rating) ? round1(rating) : null;
  const genresThemes =
    data.Genre && data.Genre !== "N/A"
      ? data.Genre.split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [];
  const cast =
    data.Actors && data.Actors !== "N/A"
      ? data.Actors.split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

  return {
    title: data.Title || "",
    description: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
    year: parseOmdbYear(data.Year),
    type: mediaType,
    image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    rating: ratingRounded,
    imdbRating: ratingRounded,
    lengthMinutes: parseRuntimeMinutes(data.Runtime),
    genresThemes,
    cast,
    director: data.Director && data.Director !== "N/A" ? data.Director : null,
    producer:
      (data.Production && data.Production !== "N/A" ? data.Production : null) ||
      (data.Writer && data.Writer !== "N/A" ? data.Writer : null),
  };
};

const fetchOmdbMetadataByTitle = async (
  title: string,
  mediaType: MediaType,
  year?: string | null,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;
  const typeParam = mediaType === "movie" || mediaType === "series" ? `&type=${mediaType}` : "";
  const yearParam = year ? `&y=${encodeURIComponent(year)}` : "";
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}&plot=full${typeParam}${yearParam}`;
  const response = await safeFetchJson(url);
  if (!response.ok) return null;
  const data = response.data as {
    Response?: string;
    Title?: string;
    Year?: string;
    Plot?: string;
    Runtime?: string;
    Genre?: string;
    Actors?: string;
    Poster?: string;
    imdbRating?: string;
    Director?: string;
    Production?: string;
    Writer?: string;
  };
  if (data.Response === "False") return null;

  const rating = data.imdbRating && data.imdbRating !== "N/A" ? Number(data.imdbRating) : null;
  const ratingRounded =
    typeof rating === "number" && Number.isFinite(rating) ? round1(rating) : null;
  const genresThemes =
    data.Genre && data.Genre !== "N/A"
      ? data.Genre.split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [];
  const cast =
    data.Actors && data.Actors !== "N/A"
      ? data.Actors.split(",")
          .map((a) => a.trim())
          .filter(Boolean)
      : [];

  return {
    title: data.Title || "",
    description: data.Plot && data.Plot !== "N/A" ? data.Plot : "",
    year: parseOmdbYear(data.Year),
    type: mediaType,
    image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
    rating: ratingRounded,
    imdbRating: ratingRounded,
    lengthMinutes: parseRuntimeMinutes(data.Runtime),
    genresThemes,
    cast,
    director: data.Director && data.Director !== "N/A" ? data.Director : null,
    producer:
      (data.Production && data.Production !== "N/A" ? data.Production : null) ||
      (data.Writer && data.Writer !== "N/A" ? data.Writer : null),
  };
};

const fetchOmdbMetadata = async (
  id: string | null,
  title: string | null,
  mediaType: MediaType,
  year?: string | null,
) => {
  if (mediaType !== "movie" && mediaType !== "series") return null;
  const isImdbId = id ? /^tt\d+$/i.test(id) : false;
  if (isImdbId) {
    const data = await fetchOmdbMetadataById(id as string, mediaType);
    if (data) return data;
  }
  if (title) return fetchOmdbMetadataByTitle(title, mediaType, year);
  return null;
};

const fetchMalMetadata = async (
  id: string,
  mediaType: MediaType,
): Promise<MetadataResult | null> => {
  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return null;
  if (mediaType !== "anime" && mediaType !== "manga") return null;

  const fields =
    mediaType === "anime"
      ? "title,main_picture,start_date,mean,synopsis,num_episodes,average_episode_duration,genres,studios"
      : "title,main_picture,start_date,mean,synopsis,num_chapters,genres,authors{first_name,last_name},serialization";
  const url = `https://api.myanimelist.net/v2/${mediaType}/${encodeURIComponent(id)}?fields=${fields}`;
  const response = await safeFetchJson(url, {
    headers: { "X-MAL-CLIENT-ID": clientId },
  });
  if (!response.ok) return null;
  const data = response.data as {
    title?: string;
    synopsis?: string;
    start_date?: string;
    mean?: number;
    main_picture?: { medium?: string };
    num_episodes?: number;
    average_episode_duration?: number;
    num_chapters?: number;
    genres?: Array<{ name?: string }>;
    studios?: Array<{ name?: string }>;
    authors?: Array<{ node: { first_name?: string; last_name?: string } }>;
    staff?: Array<{ node: { first_name?: string; last_name?: string }; role?: string }>;
    characters?: Array<{ node: { name?: string } }>;
    serialization?: Array<{ node?: { name?: string }; name?: string }>;
  };

  if (mediaType === "anime") {
    try {
      const charRes = await safeFetchJson(
        `https://api.jikan.moe/v4/anime/${encodeURIComponent(id)}/characters`,
      );
      if (charRes.ok) {
        const charData = charRes.data as { data?: Array<{ character: { name: string } }> };
        if (charData.data) {
          data.characters = charData.data
            .slice(0, 10)
            .map((c) => ({ node: { name: c.character.name } }));
        }
      }

      const staffRes = await safeFetchJson(
        `https://api.jikan.moe/v4/anime/${encodeURIComponent(id)}/staff`,
      );
      if (staffRes.ok) {
        const staffData = staffRes.data as {
          data?: Array<{ person: { name: string }; positions: string[] }>;
        };
        if (staffData.data) {
          data.staff = staffData.data.map((s) => ({
            node: { first_name: s.person.name, last_name: "" },
            role: s.positions.join(", "),
          }));
        }
      }
    } catch (e) {
      console.warn("[metadata] fetch jikan anime failed", e);
    }
  } else if (mediaType === "manga") {
    try {
      const charRes = await safeFetchJson(
        `https://api.jikan.moe/v4/manga/${encodeURIComponent(id)}/characters`,
      );
      if (charRes.ok) {
        const charData = charRes.data as { data?: Array<{ character: { name: string } }> };
        if (charData.data) {
          data.characters = charData.data
            .slice(0, 10)
            .map((c) => ({ node: { name: c.character.name } }));
        }
      }
    } catch (e) {
      console.warn("[metadata] fetch jikan manga failed", e);
    }
  }

  const lengthMinutes =
    mediaType === "anime" && typeof data.average_episode_duration === "number"
      ? Math.round(data.average_episode_duration / 60)
      : null;

  return {
    title: data.title || "",
    description: data.synopsis || "",
    year: parseYear(data.start_date),
    type: mediaType,
    image: data.main_picture?.medium || null,
    rating: typeof data.mean === "number" ? round1(data.mean) : null,
    lengthMinutes,
    episodeCount:
      mediaType === "anime" && typeof data.num_episodes === "number" ? data.num_episodes : null,
    chapterCount:
      mediaType === "manga" && typeof data.num_chapters === "number" ? data.num_chapters : null,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    cast: Array.isArray(data.characters)
      ? data.characters
          .slice(0, 5)
          .map((c) => c.node.name)
          .filter((v): v is string => Boolean(v))
      : [],
    director:
      mediaType === "manga" && Array.isArray(data.authors)
        ? data.authors
            .map((a) => `${a.node.first_name || ""} ${a.node.last_name || ""}`.trim())
            .join(", ")
        : mediaType === "anime" && Array.isArray(data.staff)
          ? data.staff
              .filter((s) => s.role?.toLowerCase().includes("director"))
              .map((s) => `${s.node.first_name || ""} ${s.node.last_name || ""}`.trim())
              .slice(0, 2)
              .join(", ") || null
          : null,
    producer: (() => {
      if (mediaType === "anime" && Array.isArray(data.studios) && data.studios.length > 0) {
        return data.studios[0]?.name || null;
      }
      if (
        mediaType === "manga" &&
        Array.isArray(data.serialization) &&
        data.serialization.length > 0
      ) {
        const s = data.serialization[0];
        if (!s) return null;
        if ("name" in s && typeof s.name === "string") return s.name;
        if ("node" in s && s.node && typeof s.node.name === "string") return s.node.name;
      }
      return null;
    })(),
  };
};

const formatIgdbCoverUrl = (url?: string) => {
  if (!url) return null;
  const normalized = url.startsWith("//") ? `https:${url}` : url;
  return normalized.replace("t_thumb", "t_cover_big");
};

const normalizeIgdbRating = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return round1(value / 10);
};

const getIgdbAccessToken = async (): Promise<{
  token: string | null;
  error: string;
}> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    return { token: null, error: "Game data provider is not configured." };

  const now = Date.now();
  if (igdbTokenCache.token && igdbTokenCache.expiresAt > now + 60_000) {
    return { token: igdbTokenCache.token, error: "" };
  }

  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
    clientSecret,
  )}&grant_type=client_credentials`;
  const response = await safeFetchJson(tokenUrl, { method: "POST" });
  if (!response.ok) return { token: null, error: response.error };
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

const fetchIgdbMetadata = async (
  id: string | null,
  title: string | null,
): Promise<MetadataResult | null> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const tokenResult = await getIgdbAccessToken();
  if (!clientId || !tokenResult.token) return null;

  const resolvedQuery =
    id && /^\d+$/.test(id)
      ? `where id = ${id};`
      : title
        ? `search "${title.replace(/"/g, "")}";`
        : "";
  if (!resolvedQuery) return null;

  const body = `${resolvedQuery} fields id,name,summary,first_release_date,cover.url,genres.name,aggregated_rating,rating,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`;
  const response = await safeFetchJson("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${tokenResult.token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!response.ok) return null;

  const payload = response.data as Array<{
    id?: number;
    name?: string;
    summary?: string;
    first_release_date?: number;
    cover?: { url?: string };
    genres?: Array<{ name?: string }>;
    aggregated_rating?: number;
    rating?: number;
    involved_companies?: Array<{
      company: { name: string };
      developer: boolean;
      publisher: boolean;
    }>;
    characters?: Array<{ name?: string }>;
  }>;
  const data = payload?.[0];
  if (!data) return null;
  const year = data.first_release_date
    ? String(new Date(data.first_release_date * 1000).getUTCFullYear())
    : undefined;
  const ratingValue = normalizeIgdbRating(data.aggregated_rating ?? data.rating);
  return {
    title: data.name || "",
    description: data.summary || "",
    year,
    type: "game",
    image: formatIgdbCoverUrl(data.cover?.url),
    rating: ratingValue,
    genresThemes: Array.isArray(data.genres)
      ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
      : [],
    cast: Array.isArray(data.characters)
      ? data.characters
          .map((c) => c.name)
          .filter((v): v is string => Boolean(v))
          .slice(0, 10)
      : [],
    director: Array.isArray(data.involved_companies)
      ? data.involved_companies.find((c) => c.developer)?.company.name || null
      : null,
    producer: Array.isArray(data.involved_companies)
      ? data.involved_companies.find((c) => c.publisher)?.company.name || null
      : null,
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as MediaType | null;
  const id = searchParams.get("id");
  const title = searchParams.get("title");
  const year = searchParams.get("year");

  if (!type || (!id && !title)) {
    return NextResponse.json(
      { data: null, error: "Missing required metadata parameters." },
      { status: 400 },
    );
  }

  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json(
      { data: null, error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

  const cacheKey = `${type}|${id || ""}|${title || ""}|${year || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ data: cached.data, cached: true });
  }

  let data: MetadataResult | null = null;

  if (type === "movie" || type === "series") {
    const [tmdbData, omdbData] = await Promise.all([
      fetchTmdbMetadata(id, title, type, year),
      fetchOmdbMetadata(id, title, type, year),
    ]);
    data = mergeMetadata(tmdbData, omdbData);
    logMissingFields("tmdb", tmdbData, type, { id, title, year });
    logMissingFields("omdb", omdbData, type, { id, title, year });
    logMissingFields("merged", data, type, { id, title, year });
    const missing = getMissingFields(data, type);
    if (missing.length > 0) {
      cache.set(cacheKey, { timestamp: Date.now(), data });
      return NextResponse.json({ data, cached: false, missingFields: missing });
    }
  } else if (type === "anime" || type === "manga") {
    if (id) data = await fetchMalMetadata(id, type);
  } else if (type === "game") {
    data = await fetchIgdbMetadata(id, title);
  }

  cache.set(cacheKey, { timestamp: Date.now(), data });
  return NextResponse.json({ data, cached: false });
}
