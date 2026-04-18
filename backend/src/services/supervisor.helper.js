// src/services/supervisor.helper.js
//
// Lógica centralizada para determinar qué instalaciones puede ver un supervisor.
// Usada por dashboard.service.js, novedades.service.js y cualquier servicio futuro
// que necesite aplicar el mismo filtro de visibilidad.

const { prisma } = require('../config/database');

/**
 * Devuelve el conjunto (sin duplicados) de IDs de instalaciones visibles
 * para un supervisor, combinando dos fuentes:
 *
 *   1. Asignaciones directas en Supervisor_Instalacion.
 *   2. Todas las instalaciones cuya `comuna` esté en `comunas_cobertura` del supervisor.
 *
 * Si ninguna fuente produce resultados, usa `instalacion_asignada_id` como
 * fallback de último recurso (útil para supervisores creados antes de la
 * migración o en entornos de demo con seed básico).
 *
 * @param {{ id: string }} user  — objeto usuario del JWT (solo necesita `id`)
 * @returns {Promise<string[]>}  — array de instalacion_id únicos
 */
const resolverInstalacionesSupervisor = async (user) => {
  // Leer comunas_cobertura e instalacion_asignada_id desde la DB,
  // ya que estos campos NO están en el JWT payload.
  const perfil = await prisma.usuario.findUnique({
    where:  { id: user.id },
    select: { comunas_cobertura: true, instalacion_asignada_id: true },
  });

  const idsSeen = new Set();

  // ── 1. Asignaciones directas ──────────────────────────────────
  const asignaciones = await prisma.supervisor_Instalacion.findMany({
    where:  { supervisor_id: user.id },
    select: { instalacion_id: true },
  });
  asignaciones.forEach((a) => idsSeen.add(a.instalacion_id));

  // ── 2. Cobertura por comunas ──────────────────────────────────
  const comunas = Array.isArray(perfil?.comunas_cobertura)
    ? perfil.comunas_cobertura.filter((c) => typeof c === 'string' && c.trim())
    : [];

  if (comunas.length > 0) {
    const porComuna = await prisma.instalacion.findMany({
      where:  { comuna: { in: comunas } },
      select: { id: true },
    });
    porComuna.forEach((i) => idsSeen.add(i.id));
  }

  // ── 3. Fallback: instalacion_asignada_id ──────────────────────
  if (idsSeen.size === 0 && perfil?.instalacion_asignada_id) {
    idsSeen.add(perfil.instalacion_asignada_id);
  }

  return [...idsSeen];
};

module.exports = { resolverInstalacionesSupervisor };
