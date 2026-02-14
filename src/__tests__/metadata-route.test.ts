import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/metadata/route";

const createRequest = (url: string, headers?: Record<string, string>) => new Request(url, { headers });

describe("metadata route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.TMDB_API_KEY = "tmdb-key";
    process.env.OMDB_API_KEY = "omdb-key";
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns complete movie metadata", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/movie/123")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            title: "Test Movie",
            overview: "Full overview",
            release_date: "2024-05-01",
            runtime: 126,
            poster_path: "/poster.jpg",
            vote_average: 7.8,
            genres: [
              { id: 12, name: "Adventure" },
              { id: 28, name: "Action" },
            ],
          }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Title: "Test Movie",
            Year: "2024",
            Plot: "Full plot",
            Runtime: "126 min",
            Genre: "Action, Adventure",
            Poster: "https://image.test/poster.jpg",
            imdbRating: "7.4",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/metadata?type=movie&id=123&title=Test%20Movie&year=2024");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.title).toBe("Test Movie");
    expect(body.data.type).toBe("movie");
    expect(body.data.lengthMinutes).toBe(126);
    expect(body.data.year).toBe("2024");
    expect(body.data.rating).toBe(7.8);
    expect(body.data.genresThemes).toEqual(expect.arrayContaining(["Adventure", "Action"]));
    expect(body.data.genreIds).toEqual(expect.arrayContaining([12, 28]));
    expect(body.data.description).toBeTruthy();
  });

  it("returns 422 for unreleased movie missing year", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/movie/777")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            title: "Unreleased",
            overview: "TBD",
            runtime: 115,
            vote_average: 0,
            genres: [{ id: 18, name: "Drama" }],
          }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Title: "Unreleased",
            Plot: "TBD",
            Runtime: "115 min",
            Genre: "Drama",
            Poster: "N/A",
            imdbRating: "N/A",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/metadata?type=movie&id=777&title=Unreleased");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.missingFields).toEqual(expect.arrayContaining(["year"]));
  });

  it("returns complete series metadata with episode count", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/tv/999")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: "Multi Season Show",
            overview: "Series overview",
            first_air_date: "2019-02-10",
            number_of_episodes: 48,
            episode_run_time: [42],
            vote_average: 8.3,
            poster_path: "/poster.jpg",
            genres: [{ id: 10765, name: "Sci-Fi & Fantasy" }],
          }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Title: "Multi Season Show",
            Year: "2019–2023",
            Plot: "Series plot",
            Genre: "Sci-Fi, Fantasy",
            Poster: "N/A",
            imdbRating: "8.0",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/metadata?type=series&id=999&title=Multi%20Season%20Show");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.type).toBe("series");
    expect(body.data.episodeCount).toBe(48);
    expect(body.data.year).toBe("2019");
    expect(body.data.genresThemes).toEqual(expect.arrayContaining(["Sci-Fi & Fantasy"]));
  });

  it("returns 422 for missing series metadata fields", async () => {
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/tv/555")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            name: "Missing Fields Show",
            first_air_date: "2020-01-01",
            poster_path: "/poster.jpg",
          }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Title: "Missing Fields Show",
            Year: "2020",
            Genre: "N/A",
            Plot: "N/A",
            imdbRating: "N/A",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/metadata?type=series&id=555&title=Missing%20Fields%20Show");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.missingFields).toEqual(
      expect.arrayContaining(["episodeCount", "description", "genresThemes", "rating"])
    );
  });

  it("retries failed TMDB requests", async () => {
    let tmdbCalls = 0;
    global.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("api.themoviedb.org/3/movie/888")) {
        tmdbCalls += 1;
        if (tmdbCalls === 1) {
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            title: "Retry Movie",
            overview: "Recovered",
            release_date: "2022-01-01",
            runtime: 100,
            vote_average: 6.9,
            genres: [{ id: 35, name: "Comedy" }],
          }),
        });
      }
      if (url.includes("www.omdbapi.com")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            Response: "True",
            Title: "Retry Movie",
            Year: "2022",
            Plot: "Recovered",
            Runtime: "100 min",
            Genre: "Comedy",
            Poster: "N/A",
            imdbRating: "6.8",
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as unknown as typeof fetch;

    const request = createRequest("https://example.com/api/metadata?type=movie&id=888&title=Retry%20Movie");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(tmdbCalls).toBe(2);
  });
});
