// File: src/states/auth/useAuthActions.ts
// Purpose: Custom hook for exposing authentication actions and loading state

import { useAuth } from "@/context/AuthContext";

export function useAuthActions() {
  const { signInWithGoogle, loading } = useAuth();

  return {
    signInWithGoogle,
    loading,
  };
}
