/**
 * Roles del sistema (Informe de Formulación, sección de Roles de Usuario).
 *
 * Los valores de cada constante son intencionalmente iguales a los strings
 * ya almacenados en `Usuario.rol` (ver prisma/schema.prisma) para no requerir
 * una migración de datos. Usar estas constantes en vez de strings sueltos
 * para que el código use el mismo lenguaje que el informe.
 */
const ROLES = {
  GGSS_EN_PAUTA: 'pauta',
  GGSS_LIBRE: 'libre',
  SUPERVISOR: 'supervisor',
  OPERADOR_CENTRAL: 'central',
  ADMINISTRADOR: 'admin',
};

module.exports = { ROLES };
