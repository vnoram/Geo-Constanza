import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { cacheClearAll } from "../utils/cache";

// ─── STORAGE KEYS ───────────────────────────────────────────────
const TOKEN_KEY = "gc_token";
const USER_KEY  = "gc_user";

// ─── AUTH CONTEXT ───────────────────────────────────────────────
export const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(null);
  const [token, setToken] = useState(null);
  // `ready` evita un flash de la pantalla de login mientras se restaura la sesión
  const [ready, setReady] = useState(false);

  // Restaurar sesión desde localStorage al montar
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser  = localStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch {
      // Storage corrupto — empezar limpio
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setReady(true);
    }
  }, []);

  const login = useCallback((u, t) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    cacheClearAll(); // Purgar todos los datos cacheados antes de limpiar la sesión
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
