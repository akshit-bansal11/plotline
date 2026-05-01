// File: src/utils/log-entry.ts
// Purpose: Helper functions for log entry date parsing and relationship mapping

// ─── Firebase
import { Timestamp } from "firebase/firestore";

// ─── Internal — types
import type { EntryDoc, EditableRelation } from "@/types/log-entry";

/**
 * Returns today's date in YYYY-MM-DD format.
 */
export const todayISODate = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

/**
 * Formats a various timestamp types into a YYYY-MM-DD string.
 */
export const formatISODate = (ts: Timestamp | Date | number | null | undefined): string => {
  if (!ts) return "";
  
  let d: Date;
  if (ts instanceof Timestamp) {
    d = ts.toDate();
  } else if (ts instanceof Date) {
    d = ts;
  } else {
    d = new Date(ts);
  }

  if (Number.isNaN(d.getTime())) return "";

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

/**
 * Parses a YYYY-MM-DD string into a Date object and milliseconds.
 */
export const parseISODate = (value: string): { date: Date; millis: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  
  // Set to noon to avoid timezone issues during date-only comparisons
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  
  return { date, millis: date.getTime() };
};

/**
 * Maps raw relationship data to full EditableRelation objects with entry details.
 */
export const buildEditableRelations = (
  raw: Array<{ targetId: string; type: string }>,
  entries: EntryDoc[],
): EditableRelation[] => {
  const seen = new Set<string>();
  
  return raw.reduce<EditableRelation[]>((acc, r) => {
    const targetId = String(r.targetId || "").trim();
    const type = String(r.type || "").trim();
    
    if (!targetId || !type || seen.has(targetId)) return acc;
    seen.add(targetId);
    
    const match = entries.find((e) => String(e.id) === targetId);
    
    acc.push({
      targetId,
      type,
      title: match?.title ?? "Unknown Entry",
      image: match?.image ?? null,
      mediaType: match?.mediaType ?? "movie",
    });
    
    return acc;
  }, []);
};
