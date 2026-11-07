const { validarArchivo, detectarTipoImagen } = require('../azureStorage');

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

test('detecta el tipo real por la firma del archivo', () => {
  expect(detectarTipoImagen(jpeg)).toBe('image/jpeg');
  expect(detectarTipoImagen(png)).toBe('image/png');
  expect(detectarTipoImagen(webp)).toBe('image/webp');
  expect(detectarTipoImagen(Buffer.from('<?php echo 1; ?> relleno relleno'))).toBeNull();
});

test('acepta imágenes cuyo contenido coincide con el tipo declarado', () => {
  expect(() => validarArchivo(jpeg, 'image/jpeg', jpeg.length)).not.toThrow();
  expect(() => validarArchivo(jpeg, 'image/jpg', jpeg.length)).not.toThrow();
  expect(() => validarArchivo(png, 'image/png', png.length)).not.toThrow();
  expect(() => validarArchivo(webp, 'image/webp', webp.length)).not.toThrow();
});

test('rechaza un archivo que declara ser imagen pero no lo es o es de otro tipo', () => {
  const script = Buffer.from('<script>alert(1)</script> contenido de relleno');
  expect(() => validarArchivo(script, 'image/png', script.length)).toThrow(expect.objectContaining({ code: 'INVALID_CONTENT', statusCode: 400 }));
  expect(() => validarArchivo(png, 'image/jpeg', png.length)).toThrow(expect.objectContaining({ code: 'INVALID_CONTENT' }));
});

test('sigue rechazando tipos no permitidos y archivos vacíos', () => {
  expect(() => validarArchivo(jpeg, 'application/pdf', jpeg.length)).toThrow(expect.objectContaining({ code: 'INVALID_TYPE' }));
  expect(() => validarArchivo(Buffer.alloc(0), 'image/png', 0)).toThrow(expect.objectContaining({ code: 'EMPTY_FILE' }));
});
