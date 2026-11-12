import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { cacheClearAll } from "../utils/cache";
import { DISPOSITIVO_ACTUAL, SESION_EXPIRADA } from "../services/sesion";
import { ROLES } from "../constants/roles";

// ─── STORAGE KEYS ───────────────────────────────────────────────
const TOKEN_KEY = "gc_token";
const USER_KEY  = "gc_user";
const REFRESH_KEY = "gc_refresh";

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

  const login = useCallback((u, t, r) => {
    localStorage.setItem(TOKEN_KEY, t);
    if (r) localStorage.setItem(REFRESH_KEY, r);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    cacheClearAll(); // Purgar todos los datos cacheados antes de limpiar la sesión
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // La sesión no se pudo renovar (refresh vencido o revocado): volver al login.
  useEffect(() => {
    window.addEventListener(SESION_EXPIRADA, logout);
    return () => window.removeEventListener(SESION_EXPIRADA, logout);
  }, [logout]);

  useEffect(() => {
    const actualizar = ({ detail }) => {
      const dispositivo = detail === 'off' ? undefined : detail;
      if (!user || user.dispositivo === dispositivo) return;
      if (detail === "personal" && ![ROLES.GGSS_EN_PAUTA, ROLES.GGSS_LIBRE].includes(user.rol)) {
        logout();
        return;
      }
      cacheClearAll();
      const actualizado = { ...user, dispositivo };
      localStorage.setItem(USER_KEY, JSON.stringify(actualizado));
      setUser(actualizado);
    };
    window.addEventListener(DISPOSITIVO_ACTUAL, actualizar);
    return () => window.removeEventListener(DISPOSITIVO_ACTUAL, actualizar);
  }, [user, logout]);

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, ready }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
