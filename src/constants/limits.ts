// File: src/constants/limits.ts
// Purpose: Central location for all magic number constants used across the app

/**
 * ─── Content Limits
 */
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_LIST_NAME_LENGTH = 80;
export const MAX_TITLE_LENGTH = 160;
export const MAX_TAGS_PER_ENTRY = 10;
export const MAX_CAST_PER_ENTRY = 20;
export const MAX_TAGS = 10;

/**
 * ─── User Limits
 */
export const MAX_ENTRIES_PER_USER = 1000;
export const MAX_LISTS_PER_USER = 50;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PROFILE_IMAGE_BYTES = 5242880; // 5MB

/**
 * ─── API & Rate Limiting
 */
export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
export const METADATA_RATE_LIMIT_MAX = 60;
export const SEARCH_RATE_LIMIT_MAX = 60;
export const RESOLVE_RATE_LIMIT_MAX = 30;
export const FORGOT_PASSWORD_RATE_LIMIT = 3;
export const FORGOT_PASSWORD_WINDOW = '1 h';

/**
 * ─── Caching
 */
export const METADATA_CACHE_TTL_MS = 300000; // 5 minutes
export const SEARCH_CACHE_TTL_MS = 300000; // 5 minutes

/**
 * ─── Fetching & Retries
 */
export const MIN_FETCH_INTERVAL_MS = 350;
export const MAX_FETCH_PER_WINDOW = 50;
export const FETCH_RETRY_COUNT = 2;
export const FETCH_RETRY_DELAY_MS = 250;
export const FETCH_TIMEOUT_MS = 8000;

/**
 * ─── Session & Auth
 */
export const SESSION_EXPIRY_DAYS = 5;

/**
 * ─── Search & Import
 */
export const SEARCH_RESULTS_LIMIT = 30;
export const IMPORT_BATCH_SIZE = 400;
export const IMPORT_MAX_EXISTING_CHECK = 1000;
