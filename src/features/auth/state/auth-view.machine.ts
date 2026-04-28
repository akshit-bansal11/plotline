import type { AuthView } from "@/types/auth";
import { AUTH_COPY } from "../data/auth-copy";

export const transitions: Record<AuthView, AuthView[]> = {
  login: ["signup", "forgot-password"],
  signup: ["login"],
  "forgot-password": ["login"],
};

export function authViewReducer(state: AuthView, action: { type: "GO_TO"; view: AuthView }): AuthView {
  if (transitions[state].includes(action.view)) {
    return action.view;
  }
  console.warn(`Invalid transition from ${state} to ${action.view}`);
  return state;
}

export const getHeading = (view: AuthView) => AUTH_COPY[view].heading;
export const getSubtext = (view: AuthView) => AUTH_COPY[view].subtext;
