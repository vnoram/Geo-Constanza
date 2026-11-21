// Muestra un RUT con puntos y guion ("203405701" -> "20.340.570-1"). Si no parece un RUT, lo deja igual.
export const formatearRut = (rut) => {
  const limpio = String(rut ?? "").replace(/[.\s-]/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return rut ?? "";
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpo}-${limpio.slice(-1)}`;
};
