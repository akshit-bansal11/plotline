import type { AuthProvider } from "@/types/auth";

export function formatAuthError(code: string): string {
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
}

export function saveLastUsedProvider(provider: AuthProvider) {
  if (typeof window !== "undefined") {
    localStorage.setItem("last_used_auth_provider", provider);
  }
}

export function getLastUsedProvider(): AuthProvider | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("last_used_auth_provider") as AuthProvider | null;
  }
  return null;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}
