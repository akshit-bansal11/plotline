import type { EntryMediaType } from "@/context/DataContext";

export type ListItemRow = {
  id: string;
  title: string;
  mediaType: EntryMediaType;
  externalId: string;
  image: string | null;
  year: string | null;
  sortOrder: number | null;
  addedAtMs: number | null;
};

export type ListRow = {
  id: string;
  name: string;
  description: string;
  type: EntryMediaType;
  types: EntryMediaType[];
};

export type ListModalType = EntryMediaType;

export type MetricCounts = { month: number; year: number; total: number };
