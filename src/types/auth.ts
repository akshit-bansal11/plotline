// File: src/types/auth.ts
// Purpose: Type definitions for authentication and user profiles

export type AuthProvider = "google" | "password";

export type AuthView = "login" | "signup" | "forgot-password";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: AuthProvider;
  lastLoginAt: string;
}

export interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
}

export interface SessionData {
  uid: string;
  email: string | null;
  lastUsedProvider: AuthProvider;
}
