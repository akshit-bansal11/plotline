// File: src/states/auth/useAuthViewState.ts
// Purpose: Custom hook for managing the active authentication view state

import { useReducer } from "react";
import type { AuthView } from "@/types/auth";
import { authViewReducer } from "./auth-view.machine";

export function useAuthViewState(initialView: AuthView = "login") {
  const [view, dispatch] = useReducer(authViewReducer, initialView);

  const goTo = (newView: AuthView) => {
    dispatch({ type: "GO_TO", view: newView });
  };

  return { view, goTo };
}
