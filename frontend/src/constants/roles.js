/**
 * Roles del sistema (Informe de Formulación, sección de Roles de Usuario).
 * Debe mantenerse en sincronía con backend/src/constants/roles.js.
 */
export const ROLES = {
  GGSS: 'ggss', // «en pauta» / «libre» se deriva de si tiene turnos programados
  SUPERVISOR: 'supervisor',
  OPERADOR_CENTRAL: 'central',
  ADMINISTRADOR: 'admin',
  SUPER_ADMIN: 'super_admin',
};
