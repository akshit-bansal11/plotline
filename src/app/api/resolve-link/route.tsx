// File: src/app/api/resolve-link/route.tsx
// Purpose: Media link resolution API route — thin orchestrator using extracted modules

// ─── Imports: Third-party
import { NextResponse } from "next/server";
import { z } from "zod";
// ─── Internal — constants/config/data
import { RATE_LIMIT_WINDOW_MS, RESOLVE_RATE_LIMIT_MAX } from "@/constants/limits";

// ─── Internal — utils/lib
import { createInMemoryRateLimit } from "@/lib/rateLimit";
import { resolveImdb } from "@/lib/resolve/imdbResolver";
import { resolveMal } from "@/lib/resolve/malResolver";
import { resolveNetflixOrPrime } from "@/lib/resolve/streamingResolver";
import { resolveTmdb } from "@/lib/resolve/tmdbResolver";
// ─── Internal — types
import type { ResolvedMedia } from "@/lib/resolve/types";
// ─── Internal — utils/links
import { parseMediaUrl } from "@/utils/parseMediaUrl";

// ─── State: Limiter
const limiter = createInMemoryRateLimit(RATE_LIMIT_WINDOW_MS, RESOLVE_RATE_LIMIT_MAX);

// ─── Validation
const BodySchema = z.object({
  url: z.string().url().trim(),
});

// ─── Helper: Get Client IP
const getClientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";
  return request.headers.get("x-real-ip") || "anonymous";
};

// ─── Route Handler
export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  if (!limiter.check(clientKey)) {
    return NextResponse.json(
      { data: null, error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

  let body: { url: string };
  try {
    const rawBody = await request.json();
    const parsedBody = BodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json({ data: null, error: "Invalid URL provided." }, { status: 400 });
    }
    body = parsedBody.data;
  } catch {
    return NextResponse.json({ data: null, error: "Invalid request body." }, { status: 400 });
  }

  const parsedUrl = parseMediaUrl(body.url);
  if (!parsedUrl) {
    return NextResponse.json(
      {
        data: null,
        error: "Unrecognized link. Supported: IMDb, TMDB, MyAnimeList, Netflix, Prime Video.",
      },
      { status: 400 },
    );
  }

  try {
    let result: ResolvedMedia | null = null;

    switch (parsedUrl.source) {
      case "imdb":
        result = await resolveImdb(parsedUrl);
        break;
      case "tmdb":
        result = await resolveTmdb(parsedUrl);
        break;
      case "mal":
        result = await resolveMal(parsedUrl);
        break;
      case "netflix":
      case "prime":
        result = await resolveNetflixOrPrime(parsedUrl);
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
    console.error("[resolve-link] route error:", err);
    return NextResponse.json(
      { data: null, error: "An unexpected error occurred while resolving the link." },
      { status: 500 },
    );
  }
}
