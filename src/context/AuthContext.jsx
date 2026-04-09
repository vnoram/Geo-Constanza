import { createContext, useContext } from "react";

// ─── AUTH CONTEXT ───
export const AuthCtx = createContext(null);

export function useAuth() {
  return useContext(AuthCtx);
}
