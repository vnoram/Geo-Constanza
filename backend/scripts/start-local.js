const path = require('path');
const dotenv = require('dotenv');

// Desarrollo siempre usa backend/.env, aunque la terminal conserve variables
// de una sesión anterior de Azure. Producción no ejecuta este archivo.
dotenv.config({
  path: path.join(__dirname, '..', '.env'),
  override: true,
});

const hostsLocales = new Set(['127.0.0.1', 'localhost', '::1']);

const exigirBaseLocal = () => {
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL local no está configurada correctamente');
  }

  if (!hostsLocales.has(url.hostname)) {
    throw new Error('Inicio local bloqueado: DATABASE_URL no apunta a PostgreSQL local');
  }
};

const exigirStorageLocal = () => {
  const connection = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
  if (connection === 'UseDevelopmentStorage=true') return;

  const endpoint = connection
    .split(';')
    .find((part) => part.startsWith('BlobEndpoint='))
    ?.slice('BlobEndpoint='.length);

  try {
    if (endpoint && hostsLocales.has(new URL(endpoint).hostname)) return;
  } catch {
    // El mensaje uniforme de abajo evita imprimir la cadena de conexión.
  }

  throw new Error('Inicio local bloqueado: Storage no apunta a Azurite local');
};

exigirBaseLocal();
exigirStorageLocal();
process.env.NODE_ENV = 'development';
if (process.env.GEO_LOCAL_PORT) process.env.PORT = process.env.GEO_LOCAL_PORT;

require('../src/server');
