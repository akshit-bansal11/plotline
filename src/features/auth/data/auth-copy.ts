import type { AuthView } from "@/types/auth";

export const AUTH_COPY: Record<AuthView, { heading: string; subtext: string }> = {
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
};
