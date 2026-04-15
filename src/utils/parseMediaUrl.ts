export type ParsedMediaUrl = {
  source: "imdb" | "tmdb" | "mal" | "netflix" | "prime" | "unknown";
  id: string | null;
  title: string | null;
  mediaType: "movie" | "series" | "anime" | "manga" | null;
  originalUrl: string;
  /** Cleaned / canonical URL to use for scraping (may differ from originalUrl) */
  cleanUrl?: string;
};

/**
 * Parse a media-platform URL and extract as much structured info as possible.
 * Returns null if the URL doesn't match any known pattern.
 */
export function parseMediaUrl(rawUrl: string): ParsedMediaUrl | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Try with https:// prefix
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

  // ------ IMDb ------
  // https://www.imdb.com/title/tt1234567/
  if (host === "imdb.com" || host.endsWith(".imdb.com")) {
    const match = path.match(/\/title\/(tt\d+)/i);
    if (match) {
      return {
        source: "imdb",
        id: match[1],
        title: null,
        mediaType: null, // OMDB will resolve this
        originalUrl: trimmed,
      };
    }
  }

  // ------ TMDB ------
  // https://www.themoviedb.org/movie/12345
  // https://www.themoviedb.org/movie/12345-some-slug  → strip slug, use ID only
  // https://www.themoviedb.org/tv/12345-some-slug
  if (host === "themoviedb.org" || host.endsWith(".themoviedb.org")) {
    const movieMatch = path.match(/\/movie\/(\d+)/);
    if (movieMatch) {
      return {
        source: "tmdb",
        id: movieMatch[1],
        title: null,
        mediaType: "movie",
        originalUrl: trimmed,
      };
    }
    const tvMatch = path.match(/\/tv\/(\d+)/);
    if (tvMatch) {
      return {
        source: "tmdb",
        id: tvMatch[1],
        title: null,
        mediaType: "series",
        originalUrl: trimmed,
      };
    }
  }

  // ------ MyAnimeList ------
  // https://myanimelist.net/anime/59062/Gachiakuta  → ID is 59062, strip trailing /slug
  // https://myanimelist.net/manga/12345/Slug
  if (host === "myanimelist.net" || host.endsWith(".myanimelist.net")) {
    const animeMatch = path.match(/\/anime\/(\d+)/);
    if (animeMatch) {
      return {
        source: "mal",
        id: animeMatch[1],
        title: null,
        mediaType: "anime",
        originalUrl: trimmed,
      };
    }
    const mangaMatch = path.match(/\/manga\/(\d+)/);
    if (mangaMatch) {
      return {
        source: "mal",
        id: mangaMatch[1],
        title: null,
        mediaType: "manga",
        originalUrl: trimmed,
      };
    }
  }

  // ------ Netflix ------
  // https://www.netflix.com/title/81450827
  // https://www.netflix.com/in/title/80100172  (country code prefix)
  // https://www.netflix.com/browse?jbv=81450827  (browse modal format)
  if (host === "netflix.com" || host.endsWith(".netflix.com")) {
    // Standard /title/<id> format
    const pathMatch = path.match(/\/title\/(\d+)/);
    if (pathMatch) {
      return {
        source: "netflix",
        id: pathMatch[1],
        title: null,
        mediaType: null,
        originalUrl: trimmed,
        cleanUrl: `https://www.netflix.com/title/${pathMatch[1]}`,
      };
    }
    // Browse modal format: ?jbv=<id>
    const jbv = url.searchParams.get("jbv");
    if (jbv && /^\d+$/.test(jbv)) {
      return {
        source: "netflix",
        id: jbv,
        title: null,
        mediaType: null,
        originalUrl: trimmed,
        cleanUrl: `https://www.netflix.com/title/${jbv}`,
      };
    }
  }

  // ------ Amazon Prime Video ------
  // https://www.primevideo.com/detail/ASIN/ref=...?jic=...  → clean to /detail/ASIN/
  // https://www.amazon.com/gp/video/detail/ASIN/...
  // https://www.amazon.com/dp/ASIN
  if (
    host === "primevideo.com" ||
    host.endsWith(".primevideo.com") ||
    host === "amazon.com" ||
    host.endsWith(".amazon.com") ||
    host.endsWith(".amazon.co.uk") ||
    host.endsWith(".amazon.in")
  ) {
    const detailMatch = path.match(/\/detail\/([A-Z0-9]+)/i);
    const dpMatch = path.match(/\/dp\/([A-Z0-9]+)/i);
    const videoDetailMatch = path.match(/\/gp\/video\/detail\/([A-Z0-9]+)/i);
    const id =
      detailMatch?.[1] || dpMatch?.[1] || videoDetailMatch?.[1] || null;
    if (id) {
      // Build a clean base URL: strip query params, fragments, and trailing ref segments
      const cleanUrl = detailMatch
        ? `https://${url.hostname}/detail/${id}/`
        : videoDetailMatch
          ? `https://${url.hostname}/gp/video/detail/${id}/`
          : `https://${url.hostname}/dp/${id}`;
      return {
        source: "prime",
        id,
        title: null,
        mediaType: null,
        originalUrl: trimmed,
        cleanUrl,
      };
    }
  }

  return null;
}

/**
 * Extract a URL from drag-and-drop data transfer.
 * Tries text/uri-list first, then text/plain.
 */
export function extractUrlFromDragEvent(
  dataTransfer: DataTransfer,
): string | null {
  // Try text/uri-list first (standard for dragged links)
  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    // text/uri-list can contain multiple URLs and comments
    const urls = uriList
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("#"));
    const first = urls[0]?.trim();
    if (
      first &&
      (first.startsWith("http://") || first.startsWith("https://"))
    ) {
      return first;
    }
  }

  // Try text/plain (e.g. dragging text that happens to be a URL)
  const text = dataTransfer.getData("text/plain")?.trim();
  if (
    text &&
    (text.startsWith("http://") ||
      text.startsWith("https://") ||
      text.startsWith("www."))
  ) {
    // Take only the first line if multi-line
    const firstLine = text.split("\n")[0]?.trim();
    if (firstLine) return firstLine;
  }

  return null;
}
