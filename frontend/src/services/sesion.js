// Renovación transparente de la sesión.
// Todas las pantallas llaman al backend con fetch y un Bearer token que vence (30 min en guardias).
// Este envoltorio de fetch:
//   1) usa siempre el access token vigente guardado (no el que quedó en las props de un componente);
//   2) ante un 401 renueva con el refresh token una sola vez (aunque fallen varias peticiones a la vez)
//      y repite la petición;
//   3) si no se puede renovar, avisa para cerrar la sesión en vez de dejar la app fallando en silencio.
import { API_URL } from "../config/api";

const TOKEN_KEY = "gc_token";
const REFRESH_KEY = "gc_refresh";
export const SESION_EXPIRADA = "gc:sesion-expirada";

// Rutas de autenticación que nunca se renuevan ni se repiten.
const RUTA_PUBLICA = /\/auth\/(login|refresh|2fa\/verify|password\/)/;

let renovando = null;

const leer = (clave) => { try { return localStorage.getItem(clave); } catch { return null; } };
const guardar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };

async function renovar(fetchOriginal) {
  const refresh = leer(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetchOriginal(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return null;
    const datos = await res.json();
    if (!datos.accessToken || !datos.refreshToken) return null;
    guardar(TOKEN_KEY, datos.accessToken);
    guardar(REFRESH_KEY, datos.refreshToken);
    return datos.accessToken;
  } catch {
    return null;
  }
}

export function instalarRenovacionDeSesion() {
  if (typeof window === "undefined" || window.__gcSesionInstalada) return;
  window.__gcSesionInstalada = true;
  const original = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.startsWith(API_URL) || RUTA_PUBLICA.test(url)) return original(input, init);

    const encabezados = new Headers(init.headers || {});
    const llevabaToken = encabezados.has("Authorization");
    const conToken = (token) => {
      const h = new Headers(init.headers || {});
      h.set("Authorization", `Bearer ${token}`);
      return { ...init, headers: h };
    };

    const vigente = leer(TOKEN_KEY);
    const res = await original(input, llevabaToken && vigente ? conToken(vigente) : init);
    if (res.status !== 401 || !llevabaToken) return res;

    if (!renovando) renovando = renovar(original).finally(() => { renovando = null; });
    const nuevo = await renovando;
    if (!nuevo) {
      window.dispatchEvent(new Event(SESION_EXPIRADA));
      return res;
    }
    return original(input, conToken(nuevo));
  };
}
