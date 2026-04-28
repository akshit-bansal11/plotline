import { useAuth } from "@/context/AuthContext";

export function useAuthActions() {
  const { signInWithGoogle, loading } = useAuth();

  return {
    signInWithGoogle,
    loading,
  };
}
