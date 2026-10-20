// Pruebas del núcleo puro de insight.service (sin base de datos).

jest.mock('../../config/database', () => ({ prisma: {} }));
jest.mock('../supervisor.helper', () => ({ resolverInstalacionesSupervisor: jest.fn() }));

const { construirInsight } = require('../insight.service');

// 2026-10-20 15:00 UTC = 12:00 en Chile (UTC-3 en horario de verano).
const AHORA = new Date('2026-10-20T15:00:00Z');

const INST = { id: 'i1', nombre: 'Edificio Central', nivel_criticidad: 'Media' };
const guardia = (id, nombre) => ({ id, nombre });
const G1 = guardia('g1', 'Ana Pérez');
const G2 = guardia('g2', 'Luis Soto');
const G3 = guardia('g3', 'Rosa Díaz');
const G4 = guardia('g4', 'Juan Mora');

let seq = 0;
const turno = (usuario, dia, ini, fin, entradaUTC, extra = {}) => ({
  id: `t${++seq}`,
  fecha: new Date(`${dia}T00:00:00Z`),
  hora_inicio: ini,
  hora_fin: fin,
  usuario,
  instalacion: INST,
  asistencias: entradaUTC ? [{ hora_entrada: new Date(entradaUTC), es_fallback: false, estado: 'normal', ...extra }] : [],
});

describe('construirInsight', () => {
  const turnos = [
    turno(G1, '2026-10-20', '08:00', '16:00', '2026-10-20T11:05:00Z'), // 5 min de retraso
    turno(G2, '2026-10-20', '09:00', '17:00', '2026-10-20T12:30:00Z'), // 30 min de retraso
    turno(G3, '2026-10-20', '10:00', '18:00', null),                    // en curso, sin marcaje
    // historial de G4: dos atrasos y una ausencia
    turno(G4, '2026-10-18', '08:00', '16:00', '2026-10-18T11:20:00Z'),
    turno(G4, '2026-10-17', '08:00', '16:00', '2026-10-17T11:30:00Z'),
    turno(G4, '2026-10-16', '08:00', '16:00', null),
    // turno futuro de G4 (hoy 20:00 en Chile)
    turno(G4, '2026-10-20', '20:00', '23:00', null),
  ];
  const novedades = [
    { id: 'n1', tipo: 'Robo', urgencia: 'rojo', estado: 'abierta', created_at: new Date('2026-10-20T14:00:00Z'), fecha_atencion: null, gps_dentro_rango: true, instalacion: INST },
    { id: 'n2', tipo: 'Falla técnica', urgencia: 'amarillo', estado: 'resuelta', created_at: new Date('2026-10-20T13:00:00Z'), fecha_atencion: new Date('2026-10-20T13:20:00Z'), gps_dentro_rango: false, instalacion: INST },
    { id: 'n3', tipo: 'Ronda', urgencia: 'verde', estado: 'resuelta', created_at: new Date('2026-10-19T13:00:00Z'), fecha_atencion: null, gps_dentro_rango: true, instalacion: INST },
  ];
  const r = construirInsight({ turnos, novedades, ahora: AHORA, dias: 30 });

  test('línea base de asistencia', () => {
    expect(r.lineaBase.turnosEvaluados).toBe(6); // el turno futuro no cuenta
    expect(r.lineaBase.turnosCubiertos).toBe(4);
    expect(r.lineaBase.turnosDescubiertos).toBe(2);
    expect(r.lineaBase.coberturaPct).toBeCloseTo(66.7, 1);
    expect(r.lineaBase.tardios).toBe(3);
    expect(r.lineaBase.tardiosPct).toBe(75);
    expect(r.lineaBase.retrasoPromedioMin).toBeCloseTo(21.3, 1);
  });

  test('línea base de novedades', () => {
    const n = r.lineaBase.novedades;
    expect(n.total).toBe(3);
    expect(n.rojas).toBe(1);
    expect(n.amarillas).toBe(1);
    expect(n.abiertas).toBe(1);
    expect(n.tiempoMedioAtencionMin).toBe(20);
    expect(n.fueraDeRangoPct).toBeCloseTo(33.3, 1);
  });

  test('genera las alertas esperadas y las ordena por prioridad', () => {
    const reglas = r.alertas.map((a) => a.regla);
    expect(reglas).toEqual(['SIN_MARCAJE', 'NOVEDAD_ROJA_PENDIENTE', 'RIESGO_RECURRENTE', 'NOVEDAD_FUERA_DE_RANGO']);
    expect(r.alertas[0].prioridad).toBe('alta');
    expect(r.alertas[0].guardia).toBe('Rosa Díaz');
    expect(r.alertas[2].guardia).toBe('Juan Mora');
    r.alertas.forEach((a) => expect(a.porQue).toEqual(expect.any(String)));
  });

  test('el turno sin marcaje en curso no se cuenta además como historial de riesgo', () => {
    const riesgo = r.alertas.filter((a) => a.regla === 'RIESGO_RECURRENTE');
    expect(riesgo).toHaveLength(1);
    expect(riesgo[0].detalle).toContain('2 atraso(s) y 1 ausencia(s)');
  });

  test('la tendencia cubre el período y suma los mismos turnos', () => {
    expect(r.tendencia.length).toBeGreaterThanOrEqual(30);
    const suma = r.tendencia.reduce((acc, d) => acc + d.evaluados, 0);
    expect(suma).toBe(r.lineaBase.turnosEvaluados);
  });

  test('el ranking por instalación usa puntos explicables', () => {
    const f = r.porInstalacion[0];
    // 2 descubiertos x3 + 3 tardíos x1 + 1 novedad roja x5 + 1 amarilla x1
    expect(f.puntos).toBe(15);
  });

  test('sin datos devuelve una estructura vacía sin fallar', () => {
    const vacio = construirInsight({ turnos: [], novedades: [], ahora: AHORA, dias: 7 });
    expect(vacio.lineaBase.coberturaPct).toBeNull();
    expect(vacio.alertas).toEqual([]);
    expect(vacio.porInstalacion).toEqual([]);
  });

  test('una instalación crítica sube a prioridad alta aunque el atraso sea corto', () => {
    const critica = { ...INST, nivel_criticidad: 'Alta' };
    const t = { ...turno(G1, '2026-10-20', '11:40', '19:00', null), instalacion: critica };
    // inicio 14:40Z → 20 min sin marcaje a las 15:00Z
    const res = construirInsight({ turnos: [t], novedades: [], ahora: AHORA, dias: 7 });
    expect(res.alertas[0].regla).toBe('SIN_MARCAJE');
    expect(res.alertas[0].prioridad).toBe('alta');
  });
});
