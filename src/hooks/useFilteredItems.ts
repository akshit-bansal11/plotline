// File: src/hooks/useFilteredItems.ts
// Purpose: Generic hook for token-based filtering of item lists

"use client";

// ─── React
import { useMemo, useState } from "react";

interface FilterOptions<TItem> {
  items: TItem[];
  getGenresThemes: (item: TItem) => string[] | null | undefined;
  getFilterValues?: (item: TItem) => Array<string | number | null | undefined> | null | undefined;
  externalFilterRaw?: string;
  onFilterRawChange?: (next: string) => void;
}

/**
 * Hook to manage token-based filtering logic.
 */
export function useFilteredItems<TItem>({
  items,
  getGenresThemes,
  getFilterValues,
  externalFilterRaw,
  onFilterRawChange,
}: FilterOptions<TItem>) {
  const [uncontrolledFilterRaw, setUncontrolledFilterRaw] = useState("");
  const resolvedFilterRaw =
    typeof externalFilterRaw === "string" ? externalFilterRaw : uncontrolledFilterRaw;
  const setResolvedFilterRaw = onFilterRawChange || setUncontrolledFilterRaw;

  // ─── Tokenization Logic
  const filterTokens = useMemo(() => {
    const accepted = resolvedFilterRaw.replace(/[^A-Za-z0-9_,.\s]/g, "");
    return accepted
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .filter((part, idx, arr) => arr.indexOf(part) === idx);
  }, [resolvedFilterRaw]);

  // ─── Filtering Logic
  const filteredItems = useMemo(() => {
    if (filterTokens.length === 0) return items;
    return items.filter((item) => {
      const tags = (getGenresThemes(item) || []).map((t) => t.toLowerCase());
      const extraValues = (getFilterValues?.(item) || [])
        .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
        .map((v) => String(v).toLowerCase());

      const combined = new Set([...tags, ...extraValues]);
      return filterTokens.some((token) => combined.has(token));
    });
  }, [filterTokens, getFilterValues, getGenresThemes, items]);

  return {
    filterRaw: resolvedFilterRaw,
    setFilterRaw: setResolvedFilterRaw,
    filteredItems,
  };
}
