const { spawnSync } = require('child_process');
const path = require('path');

const correr = (env) => spawnSync(process.execPath, [path.join(__dirname, '../../../scripts/verificar-config.js'), '--omitir-red'], {
  env: { PATH: process.env.PATH, ...env }, encoding: 'utf8',
});

test('con todo configurado no falla y nunca imprime valores secretos', () => {
  const secretos = { JWT_ACCESS_SECRET: 'secreto-acceso-123', JWT_REFRESH_SECRET: 'secreto-refresh-456', TWO_FACTOR_ENCRYPTION_KEY: 'a'.repeat(64),
    SMTP_PASS: 'clave-smtp-789', FIREBASE_PRIVATE_KEY: 'clave-privada-firebase' };
  const r = correr({ ...secretos, DATABASE_URL: 'postgresql://u:pwd-db@h/db', FRONTEND_URL: 'https://x.cl', AZURE_STORAGE_CONNECTION_STRING: 'cadena-azure',
    SMTP_HOST: 'smtp.x.cl', MAIL_FROM: 'a@x.cl', FIREBASE_PROJECT_ID: 'p', FIREBASE_CLIENT_EMAIL: 'c@p.iam', DEVICE_POLICY: 'on' });
  expect(r.status).toBe(0);
  expect(r.stdout).toContain('[OK   ] 2FA');
  for (const v of [...Object.values(secretos), 'pwd-db', 'cadena-azure']) expect(r.stdout).not.toContain(v);
});

test('si falta configuración termina con código 1 y lo dice', () => {
  const r = correr({ NODE_ENV: 'production' });
  expect(r.status).toBe(1);
  expect(r.stdout).toMatch(/FALTA\] 2FA/);
  expect(r.stdout).toMatch(/FALTA\] SMTP/);
  expect(r.stdout).toMatch(/FALTA\] Firebase/);
});
