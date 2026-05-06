// File: src/app/api/metadata/route.ts
// Purpose: Metadata enrichment API route — thin orchestrator using extracted modules

// ─── Imports: Third-party
import { NextResponse } from "next/server";
// ─── Internal — constants/config
import {
  METADATA_CACHE_TTL_MS,
  METADATA_RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
} from "@/constants/limits";
import { getEnrichedMetadata } from "@/lib/metadata";
import { getMissingFields } from "@/lib/metadata/merge";
// ─── Internal — types
import type { MetadataResult } from "@/lib/metadata/tmdb";
// ─── Internal — utils/lib
import { createInMemoryRateLimit } from "@/lib/rateLimit";
// ─── Internal — schemas
import { metadataParamsSchema } from "@/schemas/logEntry";

// ─── State: Caches & Limiter
const cache = new Map<string, { timestamp: number; data: MetadataResult | null }>();
const limiter = createInMemoryRateLimit(RATE_LIMIT_WINDOW_MS, METADATA_RATE_LIMIT_MAX);

/**
 * Extracts the client's IP address for rate limiting.
 */
const getClientKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anonymous";
  return request.headers.get("x-real-ip") || "anonymous";
};

// ─── Route Handler
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(searchParams.entries());

  // ─── Validation
  const parsed = metadataParamsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: "Invalid query parameters.", details: parsed.error.format() },
      { status: 400 },
    );
  }

  const { type, id, title, year } = parsed.data;

  // ─── Rate Limiting
  const clientKey = getClientKey(request);
  if (!limiter.check(clientKey)) {
    return NextResponse.json(
      { data: null, error: "Too many requests. Please wait." },
      { status: 429 },
    );
  }

  // ─── Caching
  const cacheKey = `${type}|${id || ""}|${title || ""}|${year || ""}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < METADATA_CACHE_TTL_MS) {
    return NextResponse.json({ data: cached.data, cached: true });
  }

  // ─── Data Fetching
  try {
    const data = await getEnrichedMetadata({ type, id, title, year });

    if (!data) {
      return NextResponse.json(
        { data: null, error: `No metadata found for ${type}.` },
        { status: 404 },
      );
    }

    const missing = getMissingFields(data, type);
    cache.set(cacheKey, { timestamp: Date.now(), data });

    return NextResponse.json({
      data,
      cached: false,
      ...(missing.length > 0 ? { missingFields: missing } : {}),
    });
  } catch (error) {
    console.error("[metadata] route error:", error);
    const message = error instanceof Error ? error.message : "Internal server error.";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
