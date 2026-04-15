export type AuthProvider = "google" | "password";

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

export type AuthView = "login" | "signup" | "forgot-password";
