// El centro operativo es la sede de la central de monitoreo (la "oficina" de la empresa).
// Se reconoce por su tipo o, en datos antiguos, por el nombre. Lo atiende el Operador Central,
// no los supervisores ni los guardias.
export const esCentroOperativo = (inst) =>
  inst?.tipo_recinto === "Centro operativo" || /^\s*centro operativo/i.test(inst?.nombre || "");
