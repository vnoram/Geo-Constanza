# Guía de desarrollo

## Requisitos
- Node.js >= 20
- PostgreSQL

## Backend (`backend/`)
```bash
npm install
npm run db:generate   # prisma generate
npm run dev            # nodemon src/server.js
npm test                # jest --coverage
```
Variables de entorno relevantes (`backend/.env`, no versionado):
`DATABASE_URL`, `JWT_SECRET`, `AZURE_STORAGE_CONNECTION_STRING`,
`AZURE_STORAGE_CONTAINER_NAME`, credenciales de Firebase.

## Frontend (`frontend/`)
```bash
npm install
npm run dev      # Vite dev server
npm run build     # build de producción (usado por Vercel)
```

## Convenciones
- **Roles**: usar siempre las constantes de `constants/roles.js`
  (backend y frontend) en vez de strings sueltos — ver [ROLES.md](ROLES.md).
- **Urgencia de novedad**: usar `constants/urgencias.js`
  (`ROJO`/`AMARILLO`/`VERDE`) en vez de strings sueltos.
- **Estados**: `constants/estados.js`, agrupados por entidad
  (`ESTADO_NOVEDAD`, `ESTADO_TURNO`, etc.) — cada modelo tiene su propio
  ciclo de vida, no son intercambiables.
- **Terminología**: usar "Novedad" en código y comentarios nuevos; no
  "incidente" ni "alerta" como sinónimos.
- **Services**: toda la lógica de negocio y acceso a Prisma vive en
  `backend/src/services/`; los controllers solo adaptan `req`/`res`.
- **Extensión de archivos**: el backend es JavaScript plano (CommonJS,
  `require`/`module.exports`); no hay compilación TypeScript configurada
  (sin `tsconfig.json`), así que los archivos nuevos deben ser `.js`.

## Despliegue
- **Frontend**: Vercel, root directory `frontend/` (ver `frontend/vercel.json`).
- **Backend**: Railway (ver `railway.json` en la raíz).

## Documentos relacionados
- [ARQUITECTURA.md](ARQUITECTURA.md)
- [ROLES.md](ROLES.md)
- [API.md](API.md)
- [HISTORIAS_DE_USUARIO.md](HISTORIAS_DE_USUARIO.md)
