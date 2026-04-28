"use client";

import { AuthView } from "../components/AuthView";
import { useAuthActions } from "../state/useAuthActions";
import { useAuthViewState } from "../state/useAuthViewState";

export function AuthContainer() {
  const { view, goTo } = useAuthViewState("login");
  const { signInWithGoogle, loading } = useAuthActions();

  return (
    <AuthView
      view={view}
      setView={goTo}
      signInWithGoogle={signInWithGoogle}
      loading={loading}
    />
  );
}
