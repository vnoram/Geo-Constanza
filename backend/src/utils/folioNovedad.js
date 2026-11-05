const { ahoraChile } = require('./fechaChile');
const { empresaActual } = require('../config/tenant');

/**
 * Siguiente folio de novedad de la empresa del contexto. Debe llamarse DENTRO de la transacción
 * que crea la novedad: el incremento es atómico (UPDATE ... SET ultimo_folio = ultimo_folio + 1
 * RETURNING) y bloquea la fila de la empresa hasta el commit, así dos novedades simultáneas de la
 * misma empresa nunca repiten ni se saltan un folio; si la transacción falla, el contador también se revierte.
 * Cada empresa tiene su propia numeración (UNIQUE(empresa_id, numero)).
 */
const siguienteFolio = async (tx) => {
  const empresaId = empresaActual();
  if (!empresaId) throw new Error('siguienteFolio requiere una empresa en el contexto');
  const { ultimo_folio: numero } = await tx.empresa.update({
    where: { id: empresaId },
    data: { ultimo_folio: { increment: 1 } },
    select: { ultimo_folio: true },
  });
  return numero;
};

const conFolio = (novedad) => ({
  ...novedad,
  folio: `NOV-${ahoraChile(new Date(novedad.created_at)).fecha.slice(0, 4)}-${String(novedad.numero).padStart(5, '0')}`,
});

module.exports = { conFolio, siguienteFolio };
