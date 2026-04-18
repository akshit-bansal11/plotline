import { Timestamp } from "firebase/firestore";
import type { EntryDoc } from "@/context/DataContext";
import type { EditableRelation } from "../types/log-entry";

export const todayISODate = (): string => {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
};

export const formatISODate = (ts: Timestamp | Date | number | null | undefined): string => {
  if (!ts) return "";
  const d = ts instanceof Timestamp ? ts.toDate() : ts instanceof Date ? ts : new Date(ts);

  if (Number.isNaN(d.getTime())) return "";

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

export const parseISODate = (value: string): { date: Date; millis: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return { date, millis: date.getTime() };
};

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
