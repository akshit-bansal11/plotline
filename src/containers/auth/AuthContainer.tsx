"use client";

import { AuthView } from "../../components/auth/AuthView";
import { useAuthActions } from "../../states/auth/useAuthActions";
import { useAuthViewState } from "../../states/auth/useAuthViewState";

export function AuthContainer() {
  const { view, goTo } = useAuthViewState("login");
  const { signInWithGoogle, loading } = useAuthActions();

  return (
    <AuthView view={view} setView={goTo} signInWithGoogle={signInWithGoogle} loading={loading} />
  );
}
