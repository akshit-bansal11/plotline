export const MAX_DESCRIPTION_LENGTH = 2000;

export function sanitizeImportedDescription(description: string): string {
  if (!description) return "";
  return description.trim().slice(0, MAX_DESCRIPTION_LENGTH);
}
