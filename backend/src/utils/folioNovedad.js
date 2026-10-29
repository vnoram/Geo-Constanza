const { ahoraChile } = require('./fechaChile');

const conFolio = (novedad) => ({
  ...novedad,
  folio: `NOV-${ahoraChile(new Date(novedad.created_at)).fecha.slice(0, 4)}-${String(novedad.numero).padStart(5, '0')}`,
});

module.exports = { conFolio };
