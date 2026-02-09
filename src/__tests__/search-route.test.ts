import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/search/route";

const createRequest = (url: string, headers?: Record<string, string>) =>
  new Request(url, { headers });

describe("search route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TMDB_API_KEY = "tmdb-key";
    process.env.OMDB_API_KEY = "omdb-key";
    process.env.MAL_CLIENT_ID = "mal-client";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], Search: [], Response: "True", data: [] }),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("queries configured sources and returns results", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            title: "Movie One",
            poster_path: "/poster.jpg",
            media_type: "movie",
            release_date: "2024-01-01",
            overview: "Overview",
            vote_average: 7.5,
          },
        ],
      }),
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Response: "True",
        Search: [
          { imdbID: "tt1", Title: "Omdb Title", Poster: "N/A", Year: "2005", Type: "movie" },
        ],
      }),
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            node: {
              id: 2,
              title: "Anime One",
              main_picture: { medium: "https://img" },
              start_date: "2022-01-01",
              synopsis: "Synopsis",
              mean: 8.2,
            },
          },
        ],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=hero&sources=tmdb,omdb,mal", {
      "x-forwarded-for": "127.0.0.1",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(body.results).toHaveLength(3);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("routes movie searches to TMDB+OMDb and dedupes results", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            title: "Dune",
            poster_path: "/poster.jpg",
            media_type: "movie",
            release_date: "2024-01-01",
            overview: "Overview",
            vote_average: 7.5,
          },
          {
            id: 2,
            name: "Dune",
            poster_path: "/poster2.jpg",
            media_type: "tv",
            first_air_date: "2024-01-01",
            overview: "Overview",
            vote_average: 7.1,
          },
        ],
      }),
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Response: "True",
        Search: [{ imdbID: "tt1", Title: "Dune", Poster: "N/A", Year: "2024", Type: "movie" }],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=dune&type=movie", {
      "x-forwarded-for": "127.0.0.5",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("movie");
  });

  it("routes series searches to TMDB+OMDb and dedupes results", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            name: "Dune",
            poster_path: "/poster.jpg",
            media_type: "tv",
            first_air_date: "2024-01-01",
            overview: "Overview",
            vote_average: 7.5,
          },
        ],
      }),
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Response: "True",
        Search: [{ imdbID: "tt1", Title: "Dune", Poster: "N/A", Year: "2024", Type: "series" }],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=dune&type=series", {
      "x-forwarded-for": "127.0.0.6",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("series");
  });

  it("routes anime searches to MAL anime endpoint", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            node: {
              id: 2,
              title: "Anime One",
              main_picture: { medium: "https://img" },
              start_date: "2022-01-01",
              synopsis: "Synopsis",
              mean: 8.2,
            },
          },
        ],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=one&type=anime", {
      "x-forwarded-for": "127.0.0.7",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.myanimelist.net/v2/anime"),
      expect.anything()
    );
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("anime");
  });

  it("routes manga searches to MAL manga endpoint", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            node: {
              id: 3,
              title: "Manga One",
              main_picture: { medium: "https://img" },
              start_date: "2010-01-01",
              synopsis: "Synopsis",
              mean: 9.1,
            },
          },
        ],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=one&type=manga", {
      "x-forwarded-for": "127.0.0.8",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.myanimelist.net/v2/manga"),
      expect.anything()
    );
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("manga");
  });

  it("routes game searches to the configured game provider", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Response: "True",
        Search: [
          { imdbID: "tt1", Title: "Game One", Poster: "N/A", Year: "2020", Type: "game" },
          { imdbID: "tt2", Title: "Movie One", Poster: "N/A", Year: "2020", Type: "movie" },
        ],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=one&type=game", {
      "x-forwarded-for": "127.0.0.9",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("game");
  });

  it("adds authentication headers to MAL calls", async () => {
    const request = createRequest("https://example.com/api/search?q=one&sources=mal", {
      "x-forwarded-for": "127.0.0.2",
    });
    await GET(request);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.myanimelist.net"),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-MAL-CLIENT-ID": "mal-client" }),
      })
    );
  });

  it("caches responses for identical queries", async () => {
    const request = createRequest("https://example.com/api/search?q=cache&sources=tmdb,omdb,mal", {
      "x-forwarded-for": "127.0.0.3",
    });
    await GET(request);
    await GET(request);

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("caches responses for identical typed queries", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: 1,
            title: "Dune",
            poster_path: "/poster.jpg",
            media_type: "movie",
            release_date: "2024-01-01",
            overview: "Overview",
            vote_average: 7.5,
          },
        ],
      }),
    });
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Response: "True",
        Search: [{ imdbID: "tt1", Title: "Dune", Poster: "N/A", Year: "2024", Type: "movie" }],
      }),
    });

    const request = createRequest("https://example.com/api/search?q=typedcache&type=movie", {
      "x-forwarded-for": "127.0.0.10",
    });
    await GET(request);
    await GET(request);

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("rate limits excessive requests", async () => {
    const request = createRequest("https://example.com/api/search?q=limit&sources=tmdb", {
      "x-forwarded-for": "127.0.0.4",
    });

    let status = 200;
    for (let i = 0; i < 61; i += 1) {
      const response = await GET(request);
      status = response.status;
    }

    expect(status).toBe(429);
  });
});
