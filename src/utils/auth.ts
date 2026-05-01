// File: src/utils/auth.ts
// Purpose: Authentication utility functions for error formatting and provider storage

// ─── Internal — types
import type { AuthProvider } from "@/types/auth";

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
export const formatAuthError = (code: string): string => {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
};

const PROVIDER_STORAGE_KEY = "last_used_auth_provider";

/**
 * Saves the last used authentication provider to local storage.
 */
export const saveLastUsedProvider = (provider: AuthProvider): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
};

/**
 * Retrieves the last used authentication provider from local storage.
 */
export const getLastUsedProvider = (): AuthProvider | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PROVIDER_STORAGE_KEY) as AuthProvider | null;
};

/**
 * Basic sanitization for user inputs to prevent simple injection.
 */
export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, "");
};
