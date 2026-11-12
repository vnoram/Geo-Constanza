const { detectarTipoAdjunto, uploadAdjuntoToAzure } = require('../azureStorage');

describe('adjuntos de solicitudes', () => {
  test('reconoce PDF e imágenes por su firma y rechaza el resto', () => {
    expect(detectarTipoAdjunto(Buffer.from('%PDF-1.7\n...'))).toBe('application/pdf');
    expect(detectarTipoAdjunto(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('image/jpeg');
    expect(detectarTipoAdjunto(Buffer.from('MZ\x90\x00 ejecutable falso'))).toBeNull();
    expect(detectarTipoAdjunto(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  test('un archivo que no es imagen ni PDF se rechaza antes de tocar Azure', async () => {
    process.env.AZURE_STORAGE_CONNECTION_STRING = 'UseDevelopmentStorage=true';
    process.env.AZURE_STORAGE_CONTAINER_NAME = 'reportes';
    await expect(uploadAdjuntoToAzure(Buffer.from('texto plano'), { usuarioId: 'u' })).rejects.toMatchObject({ statusCode: 400 });
  });
});
