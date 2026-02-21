type DuplicateEntryShape = {
    name: string;
    yearOfRelease: string | null;
    type: string;
    rating: number | null;
    description: string;
    length: number | null;
    episodes: number | null;
};

const normalizeText = (value: string | null | undefined) => (value ?? "").trim();

const normalizeNumberish = (value: number | null | undefined) => {
    if (value === null || value === undefined) return null;
    return Number.isFinite(value) ? value : null;
};

const pickDurationField = (entry: Pick<DuplicateEntryShape, "length" | "episodes">) => {
    const normalizedLength = normalizeNumberish(entry.length);
    const normalizedEpisodes = normalizeNumberish(entry.episodes);
    if (normalizedLength !== null) return { kind: "length", value: normalizedLength } as const;
    if (normalizedEpisodes !== null) return { kind: "episodes", value: normalizedEpisodes } as const;
    return { kind: "none", value: null } as const;
};

export const resolveComparableRating = (primary: number | null | undefined, secondary: number | null | undefined) => {
    const first = normalizeNumberish(primary);
    if (first !== null) return first;
    return normalizeNumberish(secondary);
};

export const createDuplicateEntryKey = (entry: DuplicateEntryShape) => {
    const duration = pickDurationField(entry);
    return JSON.stringify([
        normalizeText(entry.name),
        normalizeText(entry.yearOfRelease),
        normalizeText(entry.type),
        normalizeNumberish(entry.rating),
        normalizeText(entry.description),
        duration.kind,
        duration.value,
    ]);
};
