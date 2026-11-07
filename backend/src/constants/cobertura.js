const TOLERANCIA_POR_DEFECTO_MINUTOS = 15;
const toleranciaInstalacion = (instalacion) => instalacion?.tolerancia_atraso_minutos ?? TOLERANCIA_POR_DEFECTO_MINUTOS;
// Jornada ordinaria. Fuentes y límites de alcance en docs/INFORME_SPRINT5.md.
// No habilita jornadas excepcionales ni horas extra por medio de una variable.
const valor = process.env.MAX_HORAS_SEMANALES;
const configurado = Number(valor);
const MAX_HORAS_SEMANALES = !valor?.trim() ? 42 : Number.isFinite(configurado) && configurado > 0 ? configurado : null;
const MAX_HORAS_DIARIAS_ORDINARIAS = 10;
const limiteSemanalOrdinario = (fechaChile) => fechaChile >= '2028-04-26' ? 40 : fechaChile >= '2026-04-26' ? 42 : fechaChile >= '2024-04-26' ? 44 : 45;
module.exports = { TOLERANCIA_POR_DEFECTO_MINUTOS, toleranciaInstalacion, MAX_HORAS_SEMANALES,
  MAX_HORAS_DIARIAS_ORDINARIAS, limiteSemanalOrdinario };
