# Cómo contribuir

- Trabaja siempre en una rama; `main` solo se actualiza por Pull Request revisado y con CI verde.
- Un cambio por PR, pequeño y enfocado. Si depende de otro PR, indícalo en la descripción.
- Cada commit y PR lleva `AB#<id>` de Azure Boards. Usa `Fixes AB#<id>` solo cuando la historia queda terminada.
- JavaScript CommonJS (sin TypeScript). Hora de Chile con `backend/src/utils/fechaChile.js`; constantes en `backend/src/constants/`; sin emojis en el frontend (usar `Icon` de Lucide).
- Nunca subas secretos: usa variables de entorno; los `.env.example` van vacíos.
- Antes de abrir el PR corre `npm run lint` y `npx jest` en `backend/`, y `npm run build` en `frontend/`.
- Entorno local con Docker: ver `docs/DOCKER_LOCAL.md`. No pruebes contra producción.
