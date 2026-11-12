jest.mock('../../config/database', () => ({
  prisma: { documento: { create: jest.fn(async ({ data }) => ({ id: 'd1', created_at: new Date(), ...data })), findMany: jest.fn(async () => []) }, usuario: { findFirst: jest.fn() } },
}));
jest.mock('../../middlewares/auditLog', () => ({ registrarAuditoria: jest.fn() }));
jest.mock('../../utils/azureStorage', () => ({
  uploadAdjuntoToAzure: jest.fn(async () => 'http://blob/documentos-1.pdf'), generarUrlLectura: jest.fn(async () => 'http://blob/firmado'),
}));

const { prisma } = require('../../config/database');
const { uploadAdjuntoToAzure } = require('../../utils/azureStorage');
const { listar, subir } = require('../documentos.service');

const archivo = { buffer: Buffer.from('%PDF-1.7'), originalname: 'os10.pdf' };

describe('documentos del personal', () => {
  beforeEach(() => jest.clearAllMocks());

  test('un guardia solo puede subir su certificado OS-10, para sí mismo', async () => {
    const r = await subir({ id: 'g1', rol: 'ggss' }, { tipo: 'contrato', usuario_id: 'otro' }, archivo, {});
    expect(prisma.documento.create.mock.calls[0][0].data).toMatchObject({ tipo: 'os10', usuario_id: 'g1', subido_por: 'g1' });
    expect(r.url_firmada).toBe('http://blob/firmado');
    expect(r).not.toHaveProperty('archivo_url');
  });

  test('administración exige un guardia de la empresa y un tipo válido', async () => {
    prisma.usuario.findFirst.mockResolvedValueOnce(null);
    await expect(subir({ id: 'a1', rol: 'admin' }, { tipo: 'contrato', usuario_id: 'x' }, archivo, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(subir({ id: 'a1', rol: 'admin' }, { tipo: 'inventado', usuario_id: 'x' }, archivo, {})).rejects.toMatchObject({ statusCode: 400 });
    prisma.usuario.findFirst.mockResolvedValueOnce({ id: 'g1' });
    await subir({ id: 'a1', rol: 'admin' }, { tipo: 'liquidacion', usuario_id: 'g1', nombre: 'Liquidación marzo' }, archivo, {});
    expect(prisma.documento.create.mock.calls[0][0].data).toMatchObject({ tipo: 'liquidacion', usuario_id: 'g1', nombre: 'Liquidación marzo', subido_por: 'a1' });
  });

  test('sin archivo no se crea nada y una falla de Azure no deja un documento sin archivo', async () => {
    await expect(subir({ id: 'g1', rol: 'ggss' }, {}, undefined, {})).rejects.toMatchObject({ statusCode: 400 });
    uploadAdjuntoToAzure.mockRejectedValueOnce(new Error('azure caído'));
    await expect(subir({ id: 'g1', rol: 'ggss' }, {}, archivo, {})).rejects.toMatchObject({ statusCode: 503 });
    expect(prisma.documento.create).not.toHaveBeenCalled();
  });

  test('un guardia solo lista sus propios documentos aunque pida otro usuario', async () => {
    await listar({ id: 'g1', rol: 'ggss' }, { usuario_id: 'otro' });
    expect(prisma.documento.findMany.mock.calls[0][0].where).toEqual({ usuario_id: 'g1' });
  });
});
