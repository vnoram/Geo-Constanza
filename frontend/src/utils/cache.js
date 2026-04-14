/**
 * Utilidades de caché con localStorage.
 *
 * Patrón de uso en componentes:
 *   const [data, setData] = useState(() => cacheRead(KEYS.miClave));
 *   const [loading, setLoading] = useState(() => cacheRead(KEYS.miClave) === null);
 *
 *   // Después de fetch exitoso:
 *   setData(json); cacheWrite(KEYS.miClave, json);
 *
 * Todas las claves usan el prefijo "cache_" para que cacheClearAll()
 * las limpie correctamente al hacer logout.
 */

const DEFAULT_TTL = 10 * 60 * 1000; // 10 minutos

/** Claves de caché centralizadas para evitar typos. */
export const CACHE_KEYS = {
  adminStats:         'cache_admin_stats',
  adminAnalytics:     'cache_admin_analytics',
  adminGuardiasMapa:  'cache_admin_guardias_mapa',
  supDashboard:       'cache_sup_dashboard',
  pautaTurnoHoy:      'cache_pauta_turno_hoy',
  pautaMarcajeHoy:    'cache_pauta_marcaje_hoy',
  ggsssTurnos:        'cache_ggss_turnos',
};

/**
 * Lee un valor del localStorage.
 * Devuelve null si la clave no existe, ha expirado o está corrupta.
 */
export function cacheRead(key, ttl = DEFAULT_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Escribe un valor en el localStorage junto con el timestamp actual.
 * Falla silenciosamente si el storage no está disponible (p.ej. modo privado lleno).
 */
export function cacheWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage lleno o no disponible */ }
}

/**
 * Elimina todas las entradas cuya clave comience con "cache_".
 * Debe llamarse al hacer logout para evitar fugas de datos entre sesiones.
 */
export function cacheClearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('cache_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* noop */ }
}
