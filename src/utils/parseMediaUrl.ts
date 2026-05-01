// File: src/utils/parseMediaUrl.ts
// Purpose: Utilities for parsing media-platform URLs and extracting IDs and metadata

// ─── Internal — types
export type ParsedMediaSource = "imdb" | "tmdb" | "mal" | "netflix" | "prime" | "unknown";

export type ParsedMediaUrl = {
  source: ParsedMediaSource;
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
export const parseMediaUrl = (rawUrl: string): ParsedMediaUrl | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    // Try with https:// prefix if protocol is missing
    try {
      url = new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname;

  // ─── IMDb
  // https://www.imdb.com/title/tt1234567/
  if (host === "imdb.com" || host.endsWith(".imdb.com")) {
    const match = path.match(/\/title\/(tt\d+)/i);
    if (match) {
      return {
        source: "imdb",
        id: match[1],
        title: null,
        mediaType: null,
        originalUrl: trimmed,
      };
    }
  }

  // ─── TMDB
  // https://www.themoviedb.org/movie/12345
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

  // ─── MyAnimeList
  // https://myanimelist.net/anime/59062/Slug
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

  // ─── Netflix
  // https://www.netflix.com/title/81450827
  if (host === "netflix.com" || host.endsWith(".netflix.com")) {
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

  // ─── Amazon Prime Video
  // https://www.primevideo.com/detail/ASIN/
  const isAmazon = host === "primevideo.com" || 
                  host.endsWith(".primevideo.com") || 
                  host === "amazon.com" || 
                  host.match(/amazon\.(com|co\.uk|in|de|fr|es|it|co\.jp|ca|com\.br|com\.mx|com\.au)$/);

  if (isAmazon) {
    const detailMatch = path.match(/\/detail\/([A-Z0-9]+)/i);
    const dpMatch = path.match(/\/dp\/([A-Z0-9]+)/i);
    const videoDetailMatch = path.match(/\/gp\/video\/detail\/([A-Z0-9]+)/i);
    const id = detailMatch?.[1] || dpMatch?.[1] || videoDetailMatch?.[1] || null;
    
    if (id) {
      let cleanUrl = `https://${url.hostname}/dp/${id}`;
      if (detailMatch) cleanUrl = `https://${url.hostname}/detail/${id}/`;
      else if (videoDetailMatch) cleanUrl = `https://${url.hostname}/gp/video/detail/${id}/`;
      
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
};

/**
 * Extract a URL from drag-and-drop data transfer.
 * Tries text/uri-list first (canonical for links), then text/plain as fallback.
 */
export const extractUrlFromDragEvent = (dataTransfer: DataTransfer): string | null => {
  const uriList = dataTransfer.getData("text/uri-list");
  if (uriList) {
    const urls = uriList.split("\n").filter((line) => line.trim() && !line.startsWith("#"));
    const first = urls[0]?.trim();
    if (first && (first.startsWith("http://") || first.startsWith("https://"))) {
      return first;
    }
  }

  const text = dataTransfer.getData("text/plain")?.trim();
  if (text) {
    const firstLine = text.split("\n")[0]?.trim();
    if (firstLine && (firstLine.startsWith("http://") || firstLine.startsWith("https://") || firstLine.startsWith("www."))) {
      return firstLine;
    }
  }

  return null;
};
