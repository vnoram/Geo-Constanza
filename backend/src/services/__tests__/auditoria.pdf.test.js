jest.mock('../../config/database', () => ({ prisma: { auditoria: { findMany: jest.fn(), count: jest.fn() } } }));
jest.mock('../../middlewares/auth', () => ({ authenticate: (req, _res, next) => {
  req.user = { id: 'u1', rol: req.get('x-test-role') || require('../../constants/roles').ROLES.ADMINISTRADOR }; next();
} }));
jest.mock('../../config/logger', () => ({ logger: { error: jest.fn() } }));
const express = require('express');
const request = require('supertest');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const leerPDF = async buffer => {
  const documento = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;
  let texto = '';
  for (let i = 1; i <= documento.numPages; i++) {
    const pagina = await documento.getPage(i);
    texto += (await pagina.getTextContent()).items.map(item => item.str).join(' ');
  }
  await documento.destroy(); return texto;
};
const { prisma } = require('../../config/database');
const { exportarPDF, filtrosAuditoria } = require('../auditoria.service');
const { ROLES } = require('../../constants/roles');
const { inicioDiaChile, finDiaChile } = require('../../utils/fechaChile');
const app = express();
app.use('/auditoria', require('../../routes/auditoria.routes'));
app.use(require('../../middlewares/errorHandler').errorHandler);
const filas = [
  { id: 'audit-incluida', usuario_id: 'u1', accion: 'resolver', created_at: new Date('2026-10-30T02:59:00Z'), tabla_afectada: 'novedades', registro_id: 'registro-incluido', usuario: { nombre: 'Usuario filtrado' } },
  { id: 'audit-incluida-dos', usuario_id: 'u1', accion: 'resolver', created_at: new Date('2026-10-29T12:00:00Z'), tabla_afectada: 'novedades', registro_id: 'registro-incluido-dos', usuario: { nombre: 'Usuario filtrado' } },
  { id: 'otro-usuario', usuario_id: 'u2', accion: 'resolver', created_at: new Date('2026-10-29T12:00:00Z'), registro_id: 'EXCLUIDO-USUARIO' },
  { id: 'otra-accion', usuario_id: 'u1', accion: 'escalar', created_at: new Date('2026-10-29T12:00:00Z'), registro_id: 'EXCLUIDO-ACCION' },
  { id: 'otra-fecha', usuario_id: 'u1', accion: 'resolver', created_at: new Date('2026-10-30T03:00:00Z'), registro_id: 'EXCLUIDO-FECHA' },
];
const filtros = { usuario_id: 'u1', accion: 'resolver', fecha_inicio: '2026-10-29', fecha_fin: '2026-10-29' };
beforeEach(() => {
  jest.clearAllMocks();
  const filtrar = where => filas.filter(f => (!where.usuario_id || f.usuario_id === where.usuario_id) &&
    (!where.accion || f.accion === where.accion) && (!where.created_at?.gte || f.created_at >= where.created_at.gte) &&
    (!where.created_at?.lte || f.created_at <= where.created_at.lte));
  prisma.auditoria.findMany.mockImplementation(({ where }) => Promise.resolve(filtrar(where)));
  prisma.auditoria.count.mockImplementation(({ where }) => Promise.resolve(filtrar(where).length));
});
test('PDF generado contiene todas las filas filtradas y excluye usuario/acción/fecha ajenos', async () => {
  const pdf = await exportarPDF({ ...filtros, page: 2, limit: 1 });
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  const contenido = await leerPDF(pdf);
  expect(contenido).toContain('registro-incluido'); expect(contenido).toContain('registro-incluido-dos');
  expect(contenido).not.toMatch(/EXCLUIDO/);
  expect(prisma.auditoria.findMany.mock.calls[0][0]).not.toHaveProperty('take');
  expect(prisma.auditoria.findMany.mock.calls[0][0].where).toEqual({ usuario_id: 'u1', accion: 'resolver',
    created_at: { gte: inicioDiaChile(filtros.fecha_inicio), lte: finDiaChile(filtros.fecha_fin) } });
});
test('listado y exportación usan idénticos filtros y límite de día chileno', async () => {
  await request(app).get('/auditoria').query(filtros).expect(200);
  const whereListado = prisma.auditoria.findMany.mock.calls[0][0].where;
  await exportarPDF(filtros);
  expect(prisma.auditoria.findMany.mock.calls[1][0].where).toEqual(whereListado);
});
test('endpoint entrega PDF descargable solo a admin', async () => {
  const res = await request(app).get('/auditoria/pdf').query(filtros).expect(200).expect('Content-Type', /application\/pdf/);
  expect(res.headers['content-disposition']).toContain('bitacora-auditoria.pdf');
  await request(app).get('/auditoria/pdf').set('x-test-role', ROLES.SUPERVISOR).expect(403);
});
test('sin resultados produce PDF válido con mensaje explícito', async () => {
  const pdf = await exportarPDF({ usuario_id: 'inexistente' });
  expect(await leerPDF(pdf)).toContain('Sin registros');
});
test.each([{ fecha_inicio: '2026-02-31' }, { fecha_fin: 'invalida' }, { fecha_inicio: '2026-10-30', fecha_fin: '2026-10-29' }, { accion: ['resolver'] }])('rechaza filtro inválido %p', query => {
  expect(() => filtrosAuditoria(query)).toThrow(expect.objectContaining({ statusCode: 400 }));
});
