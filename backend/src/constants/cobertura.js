const TOLERANCIA_POR_DEFECTO_MINUTOS = 15;
const toleranciaInstalacion = (instalacion) => instalacion?.tolerancia_atraso_minutos ?? TOLERANCIA_POR_DEFECTO_MINUTOS;
// Sin un valor acordado no se aprueban nuevas coberturas; no se asume un tope legal.
const configurado = Number(process.env.MAX_HORAS_SEMANALES);
const MAX_HORAS_SEMANALES = Number.isFinite(configurado) && configurado > 0 ? configurado : null;
module.exports = { TOLERANCIA_POR_DEFECTO_MINUTOS, toleranciaInstalacion, MAX_HORAS_SEMANALES };
