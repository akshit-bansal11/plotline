// File: src/config/env.ts
// Purpose: Application-wide environment variable configuration

// ─── Environment Configuration
export const ENV = {
  RECAPTCHA_SITE_KEY: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
} as const;
