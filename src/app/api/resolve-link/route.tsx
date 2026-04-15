import { NextResponse } from "next/server";
import { type ParsedMediaUrl, parseMediaUrl } from "@/utils/parseMediaUrl";

type MediaType = "movie" | "series" | "anime" | "manga" | "game";

type ResolvedMedia = {
  id: string;
  title: string;
  image: string | null;
  year?: string;
  type: MediaType;
  description?: string;
  rating?: number | null;
  imdbRating?: number | null;
  lengthMinutes?: number | null;
  episodeCount?: number | null;
  chapterCount?: number | null;
  genresThemes?: string[];
};

type FetchResult = { ok: true; data: unknown } | { ok: false; error: string };

const safeFetchJson = async (
  url: string,
  init?: RequestInit,
): Promise<FetchResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok)
      return { ok: false, error: `Request failed with status ${res.status}` };
    const data = await res.json();
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
};

const safeFetchHtml = async (
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        ...extraHeaders,
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&apos;/g, "'");

const stripServiceSuffix = (s: string) =>
  s
    // Strip leading "Prime Video: " / "Netflix: " / "Amazon: " etc.
    .replace(
      /^(Netflix|Amazon|Prime Video|Apple TV\+?|Disney\+?|Hulu|HBO Max|Peacock|Paramount\+?|Crunchyroll)\s*[:|]\s*/i,
      "",
    )
    // Strip trailing " - Netflix" / " | Prime Video" etc.
    .replace(
      /\s*[-–—|:]\s*(Netflix|Amazon|Prime Video|Watch|Stream|IMDb).*$/i,
      "",
    )
    .replace(/\s*\(\d{4}\).*$/, "")
    .trim();

const extractTitleFromHtml = (html: string): string | null => {
  // 1. JSON-LD structured data â€” most reliable (Netflix, Prime both embed this)
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of jsonLdMatches) {
    try {
      const obj = JSON.parse(m[1]) as Record<string, unknown>;
      const name = (obj.name ?? obj.headline) as string | undefined;
      if (typeof name === "string" && name.length > 0 && name.length < 200) {
        return decodeHtmlEntities(stripServiceSuffix(name));
      }
    } catch {
      /* ignore */
    }
  }

  // 2. og:title meta tag
  const ogMatch =
    html.match(
      /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i,
    ) ||
    html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
  if (ogMatch) {
    const title = decodeHtmlEntities(stripServiceSuffix(ogMatch[1]));
    if (title.length > 0 && title.length < 200) return title;
  }

  // 3. <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    const title = decodeHtmlEntities(stripServiceSuffix(titleMatch[1]));
    if (title.length > 0 && title.length < 200) return title;
  }

  return null;
};

const parseYear = (value?: string | null) =>
  value ? value.split("-")[0] : undefined;
const round1 = (value: number) => Math.round(value * 10) / 10;

// ---- Resolvers for each source ----

async function resolveImdb(
  parsed: ParsedMediaUrl,
): Promise<ResolvedMedia | null> {
  if (!parsed.id) return null;

  // Use OMDB to get full details from IMDb ID
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(parsed.id)}&plot=full`;
  const response = await safeFetchJson(url);
  if (!response.ok) return null;

  const data = response.data as {
    Response?: string;
    Title?: string;
    Year?: string;
    Plot?: string;
    Runtime?: string;
    Genre?: string;
    Poster?: string;
    imdbRating?: string;
    Type?: string;
    totalSeasons?: string;
  };
  if (data.Response === "False") return null;

  const type: MediaType = data.Type === "series" ? "series" : "movie";
  const rawRating =
    data.imdbRating && data.imdbRating !== "N/A"
      ? Number(data.imdbRating)
      : null;
  const rating =
    typeof rawRating === "number" && Number.isFinite(rawRating)
      ? round1(rawRating)
      : null;
  const genres =
    data.Genre && data.Genre !== "N/A"
      ? data.Genre.split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : [];
  const runtimeMatch = data.Runtime?.match(/(\d+)/);
  const lengthMinutes = runtimeMatch ? Number(runtimeMatch[1]) : null;

  // If anime genres are detected, check MAL for an anime match
  const isAnimeGenre = genres.some(
    (g) => g.toLowerCase() === "animation" || g.toLowerCase() === "anime",
  );

  // Also try TMDB to get more data
  let tmdbResult: ResolvedMedia | null = null;
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const tmdbApiKey = process.env.TMDB_API_KEY;

  if (bearerToken || tmdbApiKey) {
    // Search TMDB by IMDb ID using find endpoint
    const findUrl = bearerToken
      ? `https://api.themoviedb.org/3/find/${parsed.id}?external_source=imdb_id&language=en-US`
      : `https://api.themoviedb.org/3/find/${parsed.id}?external_source=imdb_id&language=en-US&api_key=${tmdbApiKey}`;
    const headers = bearerToken
      ? { Authorization: `Bearer ${bearerToken}` }
      : undefined;
    const findResponse = await safeFetchJson(findUrl, { headers });

    if (findResponse.ok) {
      const findData = findResponse.data as {
        movie_results?: Array<{
          id?: number;
          poster_path?: string | null;
          vote_average?: number;
        }>;
        tv_results?: Array<{
          id?: number;
          poster_path?: string | null;
          vote_average?: number;
        }>;
      };
      const posterPath =
        findData.movie_results?.[0]?.poster_path ||
        findData.tv_results?.[0]?.poster_path;
      const tmdbRating =
        findData.movie_results?.[0]?.vote_average ||
        findData.tv_results?.[0]?.vote_average;

      if (posterPath) {
        tmdbResult = {
          id: parsed.id,
          title: data.Title || "",
          image: `https://image.tmdb.org/t/p/w500${posterPath}`,
          year: data.Year?.match(/\d{4}/)?.[0],
          type: isAnimeGenre ? "anime" : type,
          description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
          rating: typeof tmdbRating === "number" ? round1(tmdbRating) : rating,
          imdbRating: rating,
          lengthMinutes: type === "movie" ? lengthMinutes : null,
          genresThemes: genres,
        };
      }
    }
  }

  return (
    tmdbResult || {
      id: parsed.id,
      title: data.Title || "",
      image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
      year: data.Year?.match(/\d{4}/)?.[0],
      type: isAnimeGenre ? "anime" : type,
      description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
      rating,
      imdbRating: rating,
      lengthMinutes: type === "movie" ? lengthMinutes : null,
      genresThemes: genres,
    }
  );
}

async function resolveTmdb(
  parsed: ParsedMediaUrl,
): Promise<ResolvedMedia | null> {
  if (!parsed.id || !parsed.mediaType) return null;

  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;
  if (!bearerToken && !apiKey) return null;

  const tmdbType = parsed.mediaType === "series" ? "tv" : "movie";
  const baseUrl = `https://api.themoviedb.org/3/${tmdbType}/${parsed.id}?language=en-US`;
  const url = bearerToken ? baseUrl : `${baseUrl}&api_key=${apiKey}`;
  const headers = bearerToken
    ? { Authorization: `Bearer ${bearerToken}` }
    : undefined;

  const response = await safeFetchJson(url, { headers });
  if (!response.ok) return null;

  const data = response.data as {
    title?: string;
    name?: string;
    overview?: string;
    release_date?: string;
    first_air_date?: string;
    runtime?: number;
    number_of_episodes?: number;
    poster_path?: string | null;
    vote_average?: number;
    genres?: Array<{ name?: string }>;
    imdb_id?: string;
  };

  const genres = Array.isArray(data.genres)
    ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
    : [];

  let imdbRating: number | null = null;
  if (data.imdb_id) {
    const omdbApiKey = process.env.OMDB_API_KEY;
    if (omdbApiKey) {
      const omdbRes = await safeFetchJson(
        `https://www.omdbapi.com/?apikey=${omdbApiKey}&i=${data.imdb_id}&plot=short`,
      );
      if (omdbRes.ok) {
        const omdbData = omdbRes.data as {
          imdbRating?: string;
          Response?: string;
        };
        if (
          omdbData.Response !== "False" &&
          omdbData.imdbRating &&
          omdbData.imdbRating !== "N/A"
        ) {
          imdbRating = round1(Number(omdbData.imdbRating));
          if (!Number.isFinite(imdbRating)) imdbRating = null;
        }
      }
    }
  }

  return {
    id: parsed.id,
    title: data.title || data.name || "",
    image: data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : null,
    year: parseYear(
      parsed.mediaType === "movie" ? data.release_date : data.first_air_date,
    ),
    type: parsed.mediaType,
    description: data.overview || undefined,
    rating:
      typeof data.vote_average === "number" ? round1(data.vote_average) : null,
    imdbRating,
    lengthMinutes:
      parsed.mediaType === "movie" && typeof data.runtime === "number"
        ? data.runtime
        : null,
    episodeCount:
      parsed.mediaType === "series" &&
      typeof data.number_of_episodes === "number"
        ? data.number_of_episodes
        : null,
    genresThemes: genres,
  };
}

async function resolveMal(
  parsed: ParsedMediaUrl,
): Promise<ResolvedMedia | null> {
  if (!parsed.id || !parsed.mediaType) return null;

  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) return null;

  const malType = parsed.mediaType === "manga" ? "manga" : "anime";
  const fields =
    malType === "anime"
      ? "title,main_picture,start_date,mean,synopsis,num_episodes,average_episode_duration,genres"
      : "title,main_picture,start_date,mean,synopsis,num_chapters,genres";
  const url = `https://api.myanimelist.net/v2/${malType}/${parsed.id}?fields=${fields}`;
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
  };

  const genres = Array.isArray(data.genres)
    ? data.genres.map((g) => g.name).filter((v): v is string => Boolean(v))
    : [];

  return {
    id: parsed.id,
    title: data.title || "",
    image: data.main_picture?.medium || null,
    year: parseYear(data.start_date),
    type: parsed.mediaType,
    description: data.synopsis || undefined,
    rating: typeof data.mean === "number" ? round1(data.mean) : null,
    lengthMinutes:
      malType === "anime" && typeof data.average_episode_duration === "number"
        ? Math.round(data.average_episode_duration / 60)
        : null,
    episodeCount:
      malType === "anime" && typeof data.num_episodes === "number"
        ? data.num_episodes
        : null,
    chapterCount:
      malType === "manga" && typeof data.num_chapters === "number"
        ? data.num_chapters
        : null,
    genresThemes: genres,
  };
}

async function resolveByTitleSearch(
  title: string,
  preferredType?: MediaType | null,
): Promise<ResolvedMedia | null> {
  // Use TMDB multi search then OMDB as a fallback
  const bearerToken = process.env.TMDB_BEARER_TOKEN;
  const apiKey = process.env.TMDB_API_KEY;

  if (bearerToken || apiKey) {
    const searchUrl = bearerToken
      ? `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false`
      : `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&api_key=${apiKey}`;
    const headers = bearerToken
      ? { Authorization: `Bearer ${bearerToken}` }
      : undefined;
    const response = await safeFetchJson(searchUrl, { headers });

    if (response.ok) {
      const payload = response.data as {
        results?: Array<{
          id?: number;
          title?: string;
          name?: string;
          media_type?: string;
          poster_path?: string | null;
          release_date?: string;
          first_air_date?: string;
          overview?: string;
          vote_average?: number;
        }>;
      };
      const filtered = (payload.results || []).filter(
        (item) => item.media_type === "movie" || item.media_type === "tv",
      );
      const match = filtered[0];
      if (match) {
        const type: MediaType = match.media_type === "tv" ? "series" : "movie";
        return {
          id: String(match.id),
          title: match.title || match.name || title,
          image: match.poster_path
            ? `https://image.tmdb.org/t/p/w500${match.poster_path}`
            : null,
          year: parseYear(match.release_date || match.first_air_date),
          type: preferredType || type,
          description: match.overview || undefined,
          rating:
            typeof match.vote_average === "number"
              ? round1(match.vote_average)
              : null,
        };
      }
    }
  }

  // OMDB fallback
  const omdbKey = process.env.OMDB_API_KEY;
  if (omdbKey) {
    const url = `https://www.omdbapi.com/?apikey=${omdbKey}&t=${encodeURIComponent(title)}&plot=full`;
    const response = await safeFetchJson(url);
    if (response.ok) {
      const data = response.data as {
        Response?: string;
        Title?: string;
        Year?: string;
        Plot?: string;
        Poster?: string;
        imdbRating?: string;
        Type?: string;
        imdbID?: string;
      };
      if (data.Response !== "False" && data.Title) {
        const type: MediaType = data.Type === "series" ? "series" : "movie";
        const rating =
          data.imdbRating && data.imdbRating !== "N/A"
            ? Number(data.imdbRating)
            : null;
        const ratingRounded =
          typeof rating === "number" && Number.isFinite(rating)
            ? round1(rating)
            : null;
        return {
          id: data.imdbID || title,
          title: data.Title,
          image: data.Poster && data.Poster !== "N/A" ? data.Poster : null,
          year: data.Year?.match(/\d{4}/)?.[0],
          type: preferredType || type,
          description: data.Plot && data.Plot !== "N/A" ? data.Plot : undefined,
          rating: ratingRounded,
          imdbRating: ratingRounded,
        };
      }
    }
  }

  return null;
}

async function resolveNetflixOrPrime(
  parsed: ParsedMediaUrl,
): Promise<ResolvedMedia | null> {
  // Use the cleaned URL (no query-string noise) for scraping
  const scrapeUrl = parsed.cleanUrl ?? parsed.originalUrl;
  console.log(`[resolve-link] ${parsed.source} scraping:`, scrapeUrl);

  // Netflix: pass a cookie hint so they serve the content page instead of login wall
  const extraHeaders: Record<string, string> | undefined =
    parsed.source === "netflix"
      ? {
          Cookie: "nfvdid=BQF...; NetflixId=;",
          Referer: "https://www.netflix.com/",
        }
      : parsed.source === "prime"
        ? { Referer: "https://www.primevideo.com/" }
        : undefined;

  const html = await safeFetchHtml(scrapeUrl, extraHeaders);
  console.log(
    `[resolve-link] ${parsed.source} html length:`,
    html?.length ?? "null (fetch failed / non-200)",
  );

  let titleFromPage: string | null = null;
  if (html) {
    titleFromPage = extractTitleFromHtml(html);
    console.log(
      `[resolve-link] ${parsed.source} extracted title:`,
      titleFromPage,
    );
  }

  if (titleFromPage) {
    const byTitle = await resolveByTitleSearch(titleFromPage, null);
    console.log(
      `[resolve-link] ${parsed.source} TMDB search result:`,
      byTitle ? byTitle.title : "null",
    );
    if (byTitle) return byTitle;
  }

  return null;
}

// ---- Rate limiting ----
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

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

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  if (!checkRateLimit(clientKey)) {
    return NextResponse.json(
      { data: null, error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid request body." },
      { status: 400 },
    );
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json(
      { data: null, error: "No URL provided." },
      { status: 400 },
    );
  }

  const parsed = parseMediaUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json(
      {
        data: null,
        error:
          "Unrecognized link. Supported: IMDb, TMDB, MyAnimeList, Netflix, Prime Video.",
      },
      { status: 400 },
    );
  }

  try {
    let result: ResolvedMedia | null = null;

    switch (parsed.source) {
      case "imdb":
        result = await resolveImdb(parsed);
        break;
      case "tmdb":
        result = await resolveTmdb(parsed);
        break;
      case "mal":
        result = await resolveMal(parsed);
        break;
      case "netflix":
      case "prime":
        result = await resolveNetflixOrPrime(parsed);
        break;
    }

    if (!result) {
      return NextResponse.json(
        { data: null, error: "Could not resolve metadata from this link." },
        { status: 422 },
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[resolve-link] Fatal error:", err);
    return NextResponse.json(
      {
        data: null,
        error: "An unexpected error occurred while resolving the link.",
      },
      { status: 500 },
    );
  }
}
