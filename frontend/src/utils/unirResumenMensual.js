/** Une las filas mensuales de varios meses en una sola por instalación (promedios ponderados por turnos cubiertos). */
export function unir(listas) {
  const mapa = new Map();
  for (const lista of listas) {
    for (const f of Array.isArray(lista) ? lista : []) {
      const a = mapa.get(f.instalacion_id) ?? { instalacion_id: f.instalacion_id, instalacion: f.instalacion, turnos_programados: 0, turnos_cubiertos: 0, novedades: 0, retraso: 0, horas: 0 };
      a.turnos_programados += f.turnos_programados;
      a.turnos_cubiertos += f.turnos_cubiertos;
      a.novedades += f.novedades;
      a.retraso += f.promedio_retraso_min * f.turnos_cubiertos;
      a.horas += f.promedio_horas * f.turnos_cubiertos;
      mapa.set(f.instalacion_id, a);
    }
  }
  return [...mapa.values()].map((a) => ({
    instalacion_id: a.instalacion_id,
    instalacion: a.instalacion,
    turnos_programados: a.turnos_programados,
    turnos_cubiertos: a.turnos_cubiertos,
    novedades: a.novedades,
    cobertura: a.turnos_programados > 0 ? Math.min(100, Math.round((a.turnos_cubiertos / a.turnos_programados) * 100)) : 0,
    promedio_retraso_min: a.turnos_cubiertos ? Math.round(a.retraso / a.turnos_cubiertos) : 0,
    promedio_horas: a.turnos_cubiertos ? parseFloat((a.horas / a.turnos_cubiertos).toFixed(1)) : 0,
  }));
}

/** Agrupa las filas por guardia (una por guardia e instalación) en una fila por instalación, con la cantidad de guardias. */
export function agruparPorInstalacion(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const a = mapa.get(f.instalacion_id) ?? { instalacion_id: f.instalacion_id, instalacion: f.instalacion, guardias: new Set(), turnos_programados: 0, turnos_cubiertos: 0, novedades: 0, retraso: 0, horas: 0 };
    a.guardias.add(f.usuario_id);
    a.turnos_programados += f.turnos_programados;
    a.turnos_cubiertos += f.turnos_cubiertos;
    a.novedades += f.novedades;
    a.retraso += f.promedio_retraso_min * f.turnos_cubiertos;
    a.horas += f.promedio_horas * f.turnos_cubiertos;
    mapa.set(f.instalacion_id, a);
  }
  return [...mapa.values()].map((a) => ({
    instalacion_id: a.instalacion_id,
    instalacion: a.instalacion,
    guardias: a.guardias.size,
    turnos_programados: a.turnos_programados,
    turnos_cubiertos: a.turnos_cubiertos,
    novedades: a.novedades,
    cobertura: a.turnos_programados > 0 ? Math.min(100, Math.round((a.turnos_cubiertos / a.turnos_programados) * 100)) : 0,
    promedio_retraso_min: a.turnos_cubiertos ? Math.round(a.retraso / a.turnos_cubiertos) : 0,
    promedio_horas: a.turnos_cubiertos ? parseFloat((a.horas / a.turnos_cubiertos).toFixed(1)) : 0,
  })).sort((x, y) => x.instalacion.localeCompare(y.instalacion));
}
