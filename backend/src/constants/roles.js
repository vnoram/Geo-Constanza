/**
 * Roles del sistema (Informe de Formulación, sección de Roles de Usuario).
 *
 * Los valores de cada constante son intencionalmente iguales a los strings
 * ya almacenados en `Usuario.rol` (ver prisma/schema.prisma) para no requerir
 * una migración de datos. Usar estas constantes en vez de strings sueltos
 * para que el código use el mismo lenguaje que el informe.
 */
const ROLES = {
  // Un solo rol de guardia. «En pauta» o «libre» no es un rol: se deriva de si tiene turnos programados (tienePautaVigente).
  GGSS: 'ggss',
  SUPERVISOR: 'supervisor',
  OPERADOR_CENTRAL: 'central',
  ADMINISTRADOR: 'admin',
  // Nivel de plataforma: no pertenece a ninguna empresa y solo gestiona empresas.
  SUPER_ADMIN: 'super_admin',
};

module.exports = { ROLES };
