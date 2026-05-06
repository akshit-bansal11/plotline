// File: src/schemas/logEntry.ts
// Purpose: Zod schemas for log entry validation across forms and API routes

// ─── Third-party
import { z } from "zod";

// ─── Types: Shared
const mediaTypeSchema = z.enum(["movie", "series", "anime", "manga", "game"]);

// ─── Schema: Log Entry Input
/**
 * Schema for validating log entry data during creation or update.
 */
export const logEntryInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(160, "Title is too long"),
  mediaType: mediaTypeSchema,
  status: z.string(),
  userRating: z.number().min(0.5).max(10).nullable().optional(),
  imdbRating: z.number().min(0).max(10).nullable().optional(),
  releaseYear: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  lengthMinutes: z.number().int().nonnegative().nullable().optional(),
  episodeCount: z.number().int().nonnegative().nullable().optional(),
  chapterCount: z.number().int().nonnegative().nullable().optional(),
  totalSeasons: z.number().int().nonnegative().optional(),
  currentVolumes: z.number().int().nonnegative().optional(),
  volumeCount: z.number().int().nonnegative().optional(),
  playTime: z.number().nonnegative().nullable().optional(),
  achievements: z.number().int().nonnegative().nullable().optional(),
  totalAchievements: z.number().int().nonnegative().nullable().optional(),
  platform: z.string().nullable().optional(),
  director: z.string().nullable().optional(),
  producer: z.string().nullable().optional(),
  cast: z.array(z.string()).optional(),
  isMovie: z.boolean().optional(),
  genresThemes: z.array(z.string()).max(10, "Max 10 genres/themes allowed").optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  image: z.string().url().nullable().optional(),
  startDate: z.string().nullable().optional(),
  completionDateUnknown: z.boolean().optional(),
  currentEpisodes: z.number().int().nonnegative().optional(),
  currentSeasons: z.number().int().nonnegative().optional(),
  currentChapters: z.number().int().nonnegative().optional(),
  rewatchCount: z.number().int().nonnegative().optional(),
  relations: z
    .array(
      z.object({
        targetId: z.string(),
        type: z.string(),
        createdAtMs: z.number().optional(),
        inferred: z.boolean().optional(),
      }),
    )
    .optional(),
});

// ─── Schema: Search Params
/**
 * Schema for validating query parameters in the /api/search route.
 */
export const searchParamsSchema = z.object({
  q: z.string().min(1, "Search query is required"),
  type: mediaTypeSchema.optional(),
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

// ─── Schema: Metadata Params
/**
 * Schema for validating query parameters in the /api/metadata route.
 */
export const metadataParamsSchema = z
  .object({
    type: mediaTypeSchema,
    id: z.string().optional(),
    title: z.string().optional(),
    year: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine((data) => data.id || data.title, {
    message: "Either id or title must be provided",
    path: ["id", "title"],
  });

// ─── Inferred Types
export type LogEntryInput = z.infer<typeof logEntryInputSchema>;
export type SearchParams = z.infer<typeof searchParamsSchema>;
export type MetadataParams = z.infer<typeof metadataParamsSchema>;
