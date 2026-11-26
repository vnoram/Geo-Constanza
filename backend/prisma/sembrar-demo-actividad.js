/**
 * Actividad DEMO sintética (NO destructiva): para los guardias @alfa.demo crea ~30 días de turnos ya
 * trabajados, con asistencias variadas (puntual, tardío, ausente, marcaje por revisar) y novedades de
 * distinto tipo, urgencia y estado, para que los Indicadores tengan algo que mostrar.
 *
 * ⚠ Son datos INVENTADOS al azar (semilla fija). No sirven como evidencia ni como métrica real en el informe.
 * - Solo toca usuarios @alfa.demo. Los turnos que ya tienen asistencias se saltan, así que repetirlo no duplica.
 * - Se niega a correr contra una base que no sea local salvo --forzar.
 *
 * Requiere haber corrido antes sembrar-demo-empresa.js.
 * Uso:  docker compose exec api node prisma/sembrar-demo-actividad.js
 * Opciones:  --empresa "Seguridad Alfa Ltda."   --dias 30   --sin-hoy   --forzar
 * Además de los días pasados, los turnos de HOY ya iniciados quedan con entrada abierta (o sin marcar);
 * --sin-hoy lo omite. Conviene correrlo el mismo día de la demo, después de que empiece el turno de día.
 */
const { esBaseLocal, DIAS_ATRAS, CICLO, PLANTILLA } = require('./sembrar-demo-empresa');

// Perfil de puntualidad de cada guardia (por orden): reparte historiales distintos para que los gráficos no salgan planos.
const PERFILES = {
  ejemplar: { ausente: 0.01, tardio: 0.04, porRevisar: 0.03, extra: 0.15 },
  normal: { ausente: 0.04, tardio: 0.12, porRevisar: 0.06, extra: 0.1 },
  irregular: { ausente: 0.1, tardio: 0.28, porRevisar: 0.12, extra: 0.05 },
};
const PERFIL_POR_GUARDIA = ['ejemplar', 'normal', 'normal', 'irregular', 'normal', 'ejemplar', 'normal', 'irregular', 'normal', 'normal', 'ejemplar', 'irregular'];

// tipo → [urgencia, peso, variantes de descripción]
const NOVEDADES = [
  ['Ronda', 'verde', 30, ['Ronda perimetral completada sin hallazgos.', 'Recorrido de los accesos y estacionamientos sin observaciones.', 'Ronda de las 02:00 realizada, todo normal.']],
  ['Sin novedad', 'verde', 22, ['Turno transcurre sin novedades.', 'Sin eventos que reportar en el sector.']],
  ['Fin de ronda', 'verde', 8, ['Se cierra la ronda programada, puntos de control marcados.']],
  ['Cambio de turno', 'verde', 6, ['Entrega de turno con libro de novedades al día.', 'Relevo realizado en horario, equipos y llaves conforme.']],
  ['Puerta abierta', 'amarillo', 7, ['Puerta de servicio encontrada sin cerrar, se asegura.', 'Portón lateral abierto fuera de horario, se reporta.']],
  ['Falla técnica', 'amarillo', 5, ['Cámara 4 sin imagen desde las 23:00.', 'Falla en luminaria del estacionamiento norte.']],
  ['Alarma activada', 'amarillo', 4, ['Alarma de zona 2 se activa sin causa visible, se revisa el sector.', 'Sensor de movimiento activa alarma; falsa alarma por animal.']],
  ['Acceso no autorizado', 'amarillo', 3, ['Persona intenta ingresar sin credencial, se le deriva a recepción.']],
  ['Vandalismo', 'amarillo', 2, ['Grafiti en muro perimetral detectado durante la ronda.']],
  ['Mantenimiento', 'amarillo', 3, ['Se requiere reparación de chapa en bodega 3.', 'Filtración de agua en pasillo de acceso.']],
  ['Intrusión', 'rojo', 1.5, ['Sujeto escalando el cerco perimetral, se da aviso a carabineros.']],
  ['Robo', 'rojo', 1, ['Se detecta sustracción de herramientas en bodega, se resguarda el lugar.']],
  ['Emergencia médica', 'rojo', 1, ['Trabajador con descompensación en el acceso, se llama a ambulancia.']],
  ['Incendio', 'rojo', 0.5, ['Conato de incendio en sala eléctrica, se usa extintor y se avisa a bomberos.']],
];

const COMENTARIOS_CIERRE = [
  'Revisado en terreno, situación normalizada.', 'Se coordinó con el administrador de la instalación y quedó resuelto.',
  'Se realizó la gestión correspondiente y se cierra el caso.', 'Atendido por el supervisor, sin pendientes.',
];

/** Generador pseudoaleatorio determinista (mulberry32). */
function crearAleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (r, min, max) => min + r() * (max - min);
const enteroEntre = (r, min, max) => Math.floor(entre(r, min, max + 1));
const elegir = (r, lista) => lista[Math.floor(r() * lista.length)];

function elegirPonderado(r, items, peso) {
  const total = items.reduce((s, x) => s + peso(x), 0);
  let u = r() * total;
  for (const x of items) { u -= peso(x); if (u < 0) return x; }
  return items[items.length - 1];
}

const aISO = (d) => d.toISOString().slice(0, 10);
const sumarDias = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return aISO(new Date(Date.UTC(a, m - 1, d + n)));
};

/**
 * Fechas pasadas (ISO) en que el guardia trabajó, siguiendo el mismo ciclo 4x4 que la pauta sembrada
 * (el día 0 del ciclo es hoy - DIAS_ATRAS). Solo días anteriores a hoy.
 */
function fechasPasadas(hoyISO, desfase, dias = 30) {
  const fechas = [];
  for (let k = dias; k >= 1; k -= 1) {
    const indice = DIAS_ATRAS - k; // posición respecto del inicio de la pauta sembrada
    if ((((indice + desfase) % CICLO) + CICLO) % CICLO < 4) fechas.push(sumarDias(hoyISO, -k));
  }
  return fechas;
}

/** Offset (horas, positivo) de America/Santiago para una fecha ISO: 3 en verano, 4 en invierno. */
function offsetSantiago(fechaISO) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Santiago', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${fechaISO}T12:00:00Z`));
  const nombre = partes.find((p) => p.type === 'timeZoneName').value; // "GMT-3"
  return -Number(nombre.replace('GMT', '') || 0);
}

/** Instante UTC de una hora local de Santiago ("HH:MM") en una fecha ISO. */
function instanteLocal(fechaISO, hhmm, diasExtra = 0) {
  const [h, m] = hhmm.split(':').map(Number);
  const base = new Date(`${sumarDias(fechaISO, diasExtra)}T00:00:00Z`);
  return new Date(base.getTime() + (h + offsetSantiago(fechaISO)) * 3600000 + m * 60000);
}

/**
 * Decide cómo fue un turno: ausente, o marcaje normal / tardío / por revisar.
 * @returns {{tipo:'ausente'} | {tipo:'normal'|'tardio'|'por_revisar', retraso:number, horasTrabajadas:number, horasExtra:number, distancia:number, precision:number}}
 */
function generarMarcaje(r, perfil, duracionHoras = 12) {
  const p = PERFILES[perfil] || PERFILES.normal;
  const u = r();
  if (u < p.ausente) return { tipo: 'ausente' };
  let tipo = 'normal';
  if (u < p.ausente + p.tardio) tipo = 'tardio';
  else if (u < p.ausente + p.tardio + p.porRevisar) tipo = 'por_revisar';
  const retraso = tipo === 'tardio' ? enteroEntre(r, 6, 45) : 0;
  const horasExtra = r() < p.extra ? Math.round(entre(r, 0.5, 2) * 2) / 2 : 0;
  const horasTrabajadas = Math.round((duracionHoras - retraso / 60 + horasExtra) * 100) / 100;
  const distancia = tipo === 'por_revisar' ? enteroEntre(r, 220, 650) : enteroEntre(r, 4, 95);
  return { tipo, retraso, horasTrabajadas, horasExtra, distancia, precision: enteroEntre(r, 6, 35) };
}

/** Novedades de un turno: la mayoría sin ninguna, algunas con una o dos. */
function generarNovedades(r, hayActividad = 0.4) {
  if (r() > hayActividad) return [];
  const cantidad = r() < 0.25 ? 2 : 1;
  return Array.from({ length: cantidad }, () => {
    const [tipo, urgencia, , variantes] = elegirPonderado(r, NOVEDADES, (x) => x[2]);
    return { tipo, urgencia, descripcion: elegir(r, variantes) };
  });
}

/** Estado final de una novedad según su urgencia y qué tan antigua es (diasAtras). */
function estadoNovedad(r, urgencia, diasAtras) {
  if (urgencia === 'verde') return 'resuelta';
  const u = r();
  if (diasAtras <= 2) return u < 0.5 ? 'abierta' : u < 0.85 ? 'en_atencion' : 'resuelta';
  if (urgencia === 'rojo' && u < 0.15) return 'escalada';
  return u < 0.88 ? 'resuelta' : 'en_atencion';
}

async function main() {
  require('dotenv').config();
  const args = process.argv.slice(2);
  const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const nombreEmpresa = val('--empresa') || 'Seguridad Alfa Ltda.';
  const dias = Number(val('--dias') || 30);
  if (!esBaseLocal(process.env.DATABASE_URL) && !args.includes('--forzar')) {
    throw new Error('DATABASE_URL no es una base local. Si de verdad quieres sembrar ahí, agrega --forzar.');
  }

  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('@prisma/client');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const empresa = await prisma.empresa.findFirst({ where: { nombre: nombreEmpresa } });
    if (!empresa) throw new Error(`No existe la empresa "${nombreEmpresa}".`);
    const guardias = await prisma.usuario.findMany({
      where: { empresa_id: empresa.id, email: { endsWith: '@alfa.demo' }, rol: 'ggss' }, orderBy: { email: 'asc' },
    });
    if (!guardias.length) throw new Error('No hay guardias @alfa.demo. Corre antes prisma/sembrar-demo-empresa.js.');
    const supervisores = await prisma.usuario.findMany({ where: { empresa_id: empresa.id, email: { endsWith: '@alfa.demo' }, rol: 'supervisor' } });
    const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
    const res = { turnos: 0, ausencias: 0, asistencias: 0, novedades: 0, entradasHoy: 0, sinMarcarHoy: 0 };

    /** Crea las novedades de un turno (con folio, historial y estado según su antigüedad). */
    const crearNovedades = async ({ r, g, inst, sup, turno, novedades, entrada, minutosMax, diasAtras }) => {
      for (const nov of novedades) {
        const creada = new Date(entrada.getTime() + enteroEntre(r, 30, Math.max(31, Math.floor(minutosMax))) * 60000);
        const estado = estadoNovedad(r, nov.urgencia, diasAtras);
        const atendida = estado !== 'abierta';
        const { ultimo_folio: numero } = await prisma.empresa.update({ where: { id: empresa.id }, data: { ultimo_folio: { increment: 1 } }, select: { ultimo_folio: true } });
        const novedad = await prisma.novedad.create({ data: {
          empresa_id: empresa.id, numero, usuario_id: g.id, instalacion_id: inst.id, turno_id: turno.id, tipo: nov.tipo, descripcion: nov.descripcion,
          urgencia: nov.urgencia, estado, latitud: inst.latitud, longitud: inst.longitud, gps_dentro_rango: true, created_at: creada,
          ...(atendida ? { asignada_a: sup.id, atendida_por: estado === 'resuelta' ? sup.id : null, fecha_atencion: new Date(creada.getTime() + enteroEntre(r, 10, 90) * 60000) } : {}),
          ...(estado === 'resuelta' ? { comentario_cierre: elegir(r, COMENTARIOS_CIERRE) } : {}),
        } });
        const historial = [{ usuario_id: g.id, accion: 'crear', estado_anterior: null, estado_nuevo: 'abierta', comentario: null, created_at: creada }];
        if (atendida) historial.push({ usuario_id: sup.id, accion: estado === 'escalada' ? 'escalar' : 'asignar', estado_anterior: 'abierta', estado_nuevo: estado === 'escalada' ? 'escalada' : 'en_atencion', comentario: null, created_at: novedad.fecha_atencion });
        if (estado === 'resuelta') historial.push({ usuario_id: sup.id, accion: 'resolver', estado_anterior: 'en_atencion', estado_nuevo: 'resuelta', comentario: novedad.comentario_cierre, created_at: new Date(novedad.fecha_atencion.getTime() + 20 * 60000) });
        await prisma.novedadHistorial.createMany({ data: historial.map((h) => ({ ...h, empresa_id: empresa.id, novedad_id: novedad.id })) });
        res.novedades += 1;
      }
    };

    for (const g of guardias) {
      const n = Number(g.email.match(/guardia(\d+)@/)?.[1] || 1);
      const plan = PLANTILLA[(n - 1) % PLANTILLA.length];
      const perfil = PERFIL_POR_GUARDIA[(n - 1) % PERFIL_POR_GUARDIA.length];
      const inst = await prisma.instalacion.findFirst({ where: { empresa_id: empresa.id, id: g.instalacion_asignada_id } });
      if (!inst) continue;
      const sup = supervisores.find((s) => s.instalacion_asignada_id === inst.id) || supervisores[0];
      const r = crearAleatorio(1000 + n);
      const cruzaNoche = plan.hora_fin < plan.hora_inicio;

      for (const fecha of fechasPasadas(hoyISO, plan.desfase, dias)) {
        const fechaDb = new Date(`${fecha}T00:00:00Z`);
        let turno = await prisma.turno.findFirst({ where: { empresa_id: empresa.id, usuario_id: g.id, fecha: fechaDb, estado: { not: 'cancelado' } }, include: { asistencias: { select: { id: true } } } });
        if (turno?.asistencias.length) continue; // ya tiene actividad: no se duplica
        if (!turno) {
          turno = await prisma.turno.create({ data: {
            empresa_id: empresa.id, usuario_id: g.id, instalacion_id: inst.id, fecha: fechaDb, hora_inicio: plan.hora_inicio,
            hora_fin: plan.hora_fin, tipo_turno: cruzaNoche ? 'nocturno' : 'normal', estado: 'programado',
          } });
        }
        res.turnos += 1;
        const marca = generarMarcaje(r, perfil);
        const novedades = marca.tipo === 'ausente' ? [] : generarNovedades(r);
        if (marca.tipo === 'ausente') { res.ausencias += 1; continue; }

        const inicio = instanteLocal(fecha, plan.hora_inicio);
        const entrada = new Date(inicio.getTime() + marca.retraso * 60000 + enteroEntre(r, -8, 3) * 60000);
        const salida = new Date(entrada.getTime() + marca.horasTrabajadas * 3600000);
        const aprobado = marca.tipo === 'por_revisar' ? r() < 0.7 : null;
        const grados = (marca.distancia / 111320) * (r() < 0.5 ? 1 : -1);
        await prisma.asistencia.create({ data: {
          empresa_id: empresa.id, usuario_id: g.id, turno_id: turno.id, instalacion_id: inst.id, hora_entrada: entrada, hora_salida: salida,
          metodo_entrada: 'fallback_telefono', metodo_salida: 'fallback_telefono', estado: marca.tipo === 'tardio' ? 'tardio' : 'normal',
          minutos_retraso: marca.retraso, latitud_entrada: inst.latitud + grados, longitud_entrada: inst.longitud,
          horas_trabajadas: marca.horasTrabajadas, horas_extra: marca.horasExtra, dispositivo_usado: 'mobil_empresa',
          verificacion_gps: marca.tipo === 'por_revisar' ? 'por_revisar' : 'verificado', distancia_entrada_m: marca.distancia, precision_entrada_m: marca.precision,
          ...(marca.tipo === 'por_revisar' && aprobado !== null ? {
            revision_estado: aprobado ? 'aprobado' : 'rechazado', revisado_por: sup.id, revisado_en: new Date(entrada.getTime() + 40 * 60000),
            comentario_revision: aprobado ? 'Confirmado con el administrador de la instalación.' : 'Marcaje fuera de la instalación, no se acepta.',
          } : {}),
        } });
        res.asistencias += 1;

        const diasAtras = Math.round((new Date(`${hoyISO}T00:00:00Z`) - fechaDb) / 86400000);
        await crearNovedades({ r, g, inst, sup, turno, novedades, entrada, minutosMax: marca.horasTrabajadas * 60 - 30, diasAtras });
      }

      // Hoy: si su turno ya empezó y no tiene marcaje, queda con entrada abierta (sin salida, está trabajando),
      // o sin marcar según su perfil. Así el mapa y los Indicadores de "hoy" no salen vacíos.
      if (!args.includes('--sin-hoy')) {
        const fechaDb = new Date(`${hoyISO}T00:00:00Z`);
        const turno = await prisma.turno.findFirst({ where: { empresa_id: empresa.id, usuario_id: g.id, fecha: fechaDb, estado: { not: 'cancelado' } }, include: { asistencias: { select: { id: true } } } });
        const inicio = turno ? instanteLocal(hoyISO, turno.hora_inicio) : null;
        const ahora = new Date();
        if (turno && !turno.asistencias.length && inicio <= ahora) {
          const marca = generarMarcaje(r, perfil);
          if (marca.tipo === 'ausente') {
            res.sinMarcarHoy += 1;
          } else {
            const entrada = new Date(Math.min(ahora.getTime() - 60000, inicio.getTime() + marca.retraso * 60000 + enteroEntre(r, -8, 3) * 60000));
            const grados = (marca.distancia / 111320) * (r() < 0.5 ? 1 : -1);
            await prisma.asistencia.create({ data: {
              empresa_id: empresa.id, usuario_id: g.id, turno_id: turno.id, instalacion_id: inst.id, hora_entrada: entrada,
              metodo_entrada: 'fallback_telefono', estado: marca.tipo === 'tardio' ? 'tardio' : 'normal', minutos_retraso: marca.retraso,
              latitud_entrada: inst.latitud + grados, longitud_entrada: inst.longitud, dispositivo_usado: 'mobil_empresa',
              // Un marcaje "por revisar" de hoy queda pendiente: el supervisor lo puede aprobar en vivo.
              verificacion_gps: marca.tipo === 'por_revisar' ? 'por_revisar' : 'verificado', distancia_entrada_m: marca.distancia, precision_entrada_m: marca.precision,
            } });
            res.entradasHoy += 1;
            const minutosMax = (ahora.getTime() - entrada.getTime()) / 60000 - 5;
            if (minutosMax > 31) await crearNovedades({ r, g, inst, sup, turno, novedades: generarNovedades(r, 0.5), entrada, minutosMax, diasAtras: 0 });
          }
        }
      }
    }
    console.log(`Actividad DEMO sintética sembrada en "${empresa.nombre}" (${dias} días):`, res);
    console.log('Son datos inventados: no los uses como evidencia ni métrica real en el informe.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

module.exports = { crearAleatorio, fechasPasadas, generarMarcaje, generarNovedades, estadoNovedad, offsetSantiago, instanteLocal, elegirPonderado };

if (require.main === module) main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
