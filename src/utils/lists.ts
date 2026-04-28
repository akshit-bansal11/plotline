import type { EntryMediaType } from "@/context/DataContext";

export const coerceListType = (value: unknown): EntryMediaType => {
    if (
        value === "movie" ||
        value === "series" ||
        value === "anime" ||
        value === "manga" ||
        value === "game"
    ) {
        return value;
    }
    return "movie";
};

export const toMillis = (value: unknown) => {
    if (!value) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (
        typeof value === "object" &&
        value &&
        "toMillis" in value &&
        typeof (value as { toMillis?: unknown }).toMillis === "function"
    ) {
        const millis = (value as { toMillis: () => number }).toMillis();
        return Number.isFinite(millis) ? millis : null;
    }
    return null;
};