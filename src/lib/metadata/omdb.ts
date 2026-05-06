// File: src/lib/metadata/omdb.ts
// Purpose: OMDB API fetch functions for metadata enrichment

// ─── Internal — types
import type { EntryMediaType } from "@/types/log-entry";
// ─── Internal — utils/lib
import { safeFetchJson } from "../safeFetch";
import type { MetadataResult } from "./tmdb";

// ─── Constants & Helpers
const parseOmdbYear = (value?: string | null) => {
  if (!value) return undefined;
  const match = value.match(/\d{4}/);
  return match ? match[0] : undefined;
};

const parseRuntimeMinutes = (value?: string | null) => {
  if (!value) return null;
  const match = value.match(/(\d+)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes : null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

// ─── OMDB Functions

/**
 * Fetch OMDB metadata by IMDb ID
 */
export const fetchOmdbMetadataById = async (
  id: string,
  mediaType: EntryMediaType,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(id)}&plot=full`;
  const response = await safeFetchJson<{
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
  }>(url);
  if (!response.ok) return null;

  const data = response.data;
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

/**
 * Fetch OMDB metadata by searching for title
 */
export const fetchOmdbMetadataByTitle = async (
  title: string,
  mediaType: EntryMediaType,
  year?: string | null,
): Promise<MetadataResult | null> => {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;
  const typeParam = mediaType === "movie" || mediaType === "series" ? `&type=${mediaType}` : "";
  const yearParam = year ? `&y=${encodeURIComponent(year)}` : "";
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&t=${encodeURIComponent(title)}&plot=full${typeParam}${yearParam}`;

  const response = await safeFetchJson<{
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
  }>(url);
  if (!response.ok) return null;

  const data = response.data;
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

/**
 * Fetch OMDB metadata by IMDb ID or by searching title
 */
export const fetchOmdbMetadata = async (
  id: string | null,
  title: string | null,
  mediaType: EntryMediaType,
  year?: string | null,
): Promise<MetadataResult | null> => {
  if (mediaType !== "movie" && mediaType !== "series") return null;
  const isImdbId = id ? /^tt\d+$/i.test(id) : false;
  if (isImdbId) {
    const data = await fetchOmdbMetadataById(id as string, mediaType);
    if (data) return data;
  }
  if (title) return fetchOmdbMetadataByTitle(title, mediaType, year);
  return null;
};
