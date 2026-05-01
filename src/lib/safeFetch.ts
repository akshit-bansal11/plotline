// File: lib/safeFetch.ts
// Purpose: Shared safeFetchJson and safeFetchHtml utilities for server-side API routes

// ─── Internal — constants/config/data
import {
  FETCH_RETRY_COUNT,
  FETCH_RETRY_DELAY_MS,
  FETCH_TIMEOUT_MS,
} from "@/constants/limits";

// ─── Internal — types
export type FetchResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

// ─── Helper: safeFetchJson
/**
 * Fetch a JSON response with retries, timeout, and exponential backoff
 */
export const safeFetchJson = async <T = unknown>(
  url: string,
  init?: RequestInit,
  retries: number = FETCH_RETRY_COUNT
): Promise<FetchResult<T>> => {
  const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      if (res.ok) {
        const data = await res.json();
        return { ok: true, data: data as T };
      }

      const error = `Request failed with status ${res.status}`;
      const shouldRetry = res.status === 429 || res.status >= 500;

      if (shouldRetry && attempt < retries) {
        // Exponential backoff
        await sleep(FETCH_RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      return { ok: false, error };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      
      if (attempt < retries) {
        await sleep(FETCH_RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      return { ok: false, error: message };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, error: "Request failed after maximum retries" };
};

// ─── Helper: safeFetchHtml
/**
 * Fetch HTML content from a URL with a modern User-Agent
 */
export const safeFetchHtml = async (
  url: string,
  extraHeaders?: Record<string, string>
): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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
        "Cache-Control": "no-cache",
        ...extraHeaders,
      },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch (error) {
    console.error(`[safeFetchHtml] failed for ${url}:`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};
