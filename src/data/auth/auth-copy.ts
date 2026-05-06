// File: src/data/auth/auth-copy.ts
// Purpose: Content strings for authentication views (headings and subtexts)

// ─── Internal — types
import type { AuthView } from "@/types/auth";

/**
 * Display text for various authentication views.
 */
export const AUTH_COPY: Readonly<
  Record<AuthView, { readonly heading: string; readonly subtext: string }>
> = {
  login: {
    heading: "Welcome back",
    subtext: "Sign in to continue to Plotline",
  },
  signup: {
    heading: "Create an account",
    subtext: "Create an account to get started",
  },
  "forgot-password": {
    heading: "Reset your password",
    subtext: "Reset your account password",
  },
} as const;
