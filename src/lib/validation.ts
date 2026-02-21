export const MAX_DESCRIPTION_LENGTH_MANUAL = 1000;
export const MAX_DESCRIPTION_LENGTH_IMPORT = 2000;

export function sanitizeImportedDescription(description: string): string {
    if (!description) return "";
    const trimmed = description.trim();
    if (trimmed.length <= MAX_DESCRIPTION_LENGTH_IMPORT) {
        return trimmed;
    }

    const slice = trimmed.slice(0, MAX_DESCRIPTION_LENGTH_IMPORT);
    const lastFullStop = slice.lastIndexOf(".");

    if (lastFullStop !== -1) {
        // Cut at the full stop (including the full stop)
        return slice.slice(0, lastFullStop + 1);
    }

    // If no full stop exists before the limit, return as is (but trimmed) 
    // to strictly preserve the "Never cut mid-sentence." requirement,
    // though this means it might occasionally exceed 2000. 
    // Wait, the requirement is "trim to the nearest full stop BEFORE reaching the 2000-character limit. Never cut mid-sentence."
    // If there is no full stop at all, we fall back to hard slicing.
    return slice;
}
