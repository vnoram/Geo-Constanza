const { analizar } = require('../../../scripts/detectar-solapamientos');

test('detector informa choques y abiertas duplicadas, sin contar contiguos ni otros guardias', () => {
  const base = { usuario_id: 'u', instalacion_id: 'i', estado: 'programado' };
  const a = { ...base, id: 'A', fecha: '2026-09-26', hora_inicio: '20:00', hora_fin: '08:00' };
  const b = { ...base, id: 'B', fecha: '2026-09-27', hora_inicio: '00:00', hora_fin: '14:00' };
  const c = { ...base, id: 'C', fecha: '2026-09-27', hora_inicio: '14:00', hora_fin: '22:00' };
  const resultado = analizar([a, b, c, { ...a, id: 'D', usuario_id: 'otro' }, { ...a, id: 'E', estado: 'cancelado' }], [
    { id: '1', usuario_id: 'u', turno_id: 'A', hora_salida: null },
    { id: '2', usuario_id: 'u', turno_id: 'B', hora_salida: null },
    { id: '3', usuario_id: 'otro', turno_id: 'D', hora_salida: null },
    { id: '4', usuario_id: 'otro', turno_id: 'D', hora_salida: new Date() },
  ]);
  expect(resultado.solapamientos).toHaveLength(1);
  expect(resultado.solapamientos[0].turnos.map((t) => t.id)).toEqual(['A', 'B']);
  expect(resultado.asistencias_duplicadas).toEqual([{ usuario_id: 'u', asistencias: [
    { id: '1', turno_id: 'A', hora_entrada: undefined }, { id: '2', turno_id: 'B', hora_entrada: undefined },
  ] }]);
});
