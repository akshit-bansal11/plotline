// File: src/types/lists.ts
// Purpose: Type definitions for user lists and metrics

// ─── Internal — types
import type { EntryMediaType } from "./log-entry";

export interface ListItemRow {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  externalId: string;
  image: string | null;
  year: string | null;
  sortOrder: number | null;
  addedAtMs: number | null;
}

export interface ListRow {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
}

export type ListModalType = EntryMediaType;

export interface MetricCounts {
  month: number;
  year: number;
  total: number;
}
