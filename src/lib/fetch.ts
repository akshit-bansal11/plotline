// File: src/lib/fetch.ts
// Purpose: Resilient fetch wrapper with timeout and retry logic for external APIs

/**
 * Options for the safeFetch utility.
 */
export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

/**
 * A wrapper around fetch that adds timeout and simple retry logic.
 */
export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 8000, retries = 2, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort (timeout) if we've exhausted retries
      if (attempt < retries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 500));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
}
