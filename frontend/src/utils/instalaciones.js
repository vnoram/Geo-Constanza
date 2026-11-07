// El centro operativo es la sede de la central de monitoreo (la "oficina" de la empresa).
// Lo define el tipo de recinto elegido al crear o editar la instalación, y lo atiende el
// Operador Central, no los supervisores ni los guardias.
export const esCentroOperativo = (inst) => inst?.tipo_recinto === "Centro operativo";
