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
    process.env.TWITCH_CLIENT_ID = "twitch-client";
    process.env.TWITCH_CLIENT_SECRET = "twitch-secret";
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("id.twitch.tv/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 3600 }),
        });
      }
      if (url.includes("api.igdb.com/v4/games")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      if (url.includes("api.myanimelist.net")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ Response: "True", Search: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ results: [] }),
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("queries configured sources and returns results", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org")) {
        return Promise.resolve({
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
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Search: [
              { imdbID: "tt1", Title: "Omdb Title", Poster: "N/A", Year: "2005", Type: "movie" },
            ],
          }),
        });
      }
      if (url.includes("api.myanimelist.net/v2/anime")) {
        return Promise.resolve({
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
      }
      if (url.includes("api.myanimelist.net/v2/manga")) {
        return Promise.resolve({
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
      }
      if (url.includes("id.twitch.tv/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 3600 }),
        });
      }
      if (url.includes("api.igdb.com/v4/games")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 10,
              name: "Game One",
              cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/cover.png" },
              first_release_date: 1609459200,
              summary: "Summary",
              rating: 82.5,
            },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/search?q=hero", {
      "x-forwarded-for": "127.0.0.1",
    });
    const response = await GET(request);
    const body = await response.json();

    expect(body.results).toHaveLength(5);
    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it("routes movie searches to the movie/series providers and dedupes results", async () => {
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

    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("movie");
  });

  it("routes series searches to the movie/series providers and dedupes results", async () => {
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

    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
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
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("id.twitch.tv/oauth2/token")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ access_token: "token", expires_in: 3600 }),
        });
      }
      if (url.includes("api.igdb.com/v4/games")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 11,
              name: "Game One",
              cover: { url: "//images.igdb.com/igdb/image/upload/t_thumb/game.png" },
              first_release_date: 1577836800,
              summary: "Summary",
              aggregated_rating: 88.1,
            },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/search?q=one&type=game", {
      "x-forwarded-for": "127.0.0.9",
    });
    const response = await GET(request);
    const body = await response.json();

    expect((global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]?.type).toBe("game");
  });

  it("adds authentication headers to MAL calls", async () => {
    const request = createRequest("https://example.com/api/search?q=header-check&type=anime", {
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
    const request = createRequest("https://example.com/api/search?q=cache", {
      "x-forwarded-for": "127.0.0.3",
    });
    await GET(request);
    const callsAfterFirst = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await GET(request);
    const callsAfterSecond = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(callsAfterSecond).toBe(callsAfterFirst);
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
    const callsAfterFirst = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    await GET(request);
    const callsAfterSecond = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfterSecond).toBe(callsAfterFirst);
  });

  it("rate limits excessive requests", async () => {
    const request = createRequest("https://example.com/api/search?q=limit", {
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
