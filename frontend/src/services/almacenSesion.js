// La sesión (access token, refresh token y usuario) vive solo en sessionStorage:
// se borra al cerrar la pestaña o el navegador, así una sesión abierta no queda
// disponible para la siguiente persona que use el equipo.
// El token del dispositivo corporativo NO va aquí: es del equipo, no de la persona (ver services/dispositivos.js).
const CLAVES_SESION = ["gc_token", "gc_refresh", "gc_user"];

export const leerSesion = (clave) => { try { return sessionStorage.getItem(clave); } catch { return null; } };
export const guardarSesion = (clave, valor) => { try { sessionStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } };
export const borrarSesion = (clave) => { try { sessionStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };

// Versiones anteriores guardaban la sesión en localStorage (persistía aunque se cerrara el navegador): se eliminan.
export function limpiarSesionAntigua() {
  try { CLAVES_SESION.forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
}
