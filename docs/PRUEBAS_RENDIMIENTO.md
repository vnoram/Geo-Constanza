# Pruebas de rendimiento (medición local)

Medición del 4 de noviembre de 2026 para respaldar con números las afirmaciones de rendimiento del informe. Son cifras de **un entorno de desarrollo pequeño**, no de producción: sirven para comparar endpoints y detectar cuellos de botella, no como garantía de nivel de servicio.

## Entorno

- API Node 22 en una máquina virtual de 2 CPU y 8 GB de RAM, junto con PostgreSQL 16 y Redis en la misma máquina (sin red entre ellos).
- Datos del seed (pocos registros). Con más datos las consultas de listados serán más lentas.
- Límites de peticiones subidos solo para esta prueba (`RATE_LIMIT_PUBLIC` y `RATE_LIMIT_AUTHENTICATED`), para medir la aplicación y no el limitador.
- Herramienta: `autocannon` 7.15.0 (no se agrega al proyecto). 20 conexiones simultáneas, 12 s por escenario; el login, 10 conexiones y 10 s.

## Cómo repetirlo

```bash
npx autocannon -c 20 -d 12 http://localhost:3055/api/v1/health
npx autocannon -c 20 -d 12 -H "Authorization=Bearer <token>" http://localhost:3055/api/v1/novedades
npx autocannon -c 10 -d 10 -m POST -H "Content-Type=application/json" \
  -b '{"rut":"15678901-2","password":"geo2026"}' http://localhost:3055/api/v1/auth/login
```

El token se obtiene con un login previo. Hacerlo siempre contra el entorno local, nunca contra producción.

## Resultados

| Escenario | Solicitudes/s | p50 | p97,5 | p99 | Errores |
|---|---|---|---|---|---|
| `GET /health` | 2.355 | 6 ms | 26 ms | 34 ms | 0 |
| `GET /health/ready` (consulta la base) | 1.838 | 9 ms | 19 ms | 24 ms | 0 |
| `GET /novedades` (supervisor) | 439 | 43 ms | 70 ms | 83 ms | 0 |
| `GET /dashboard/hoy` (central) | 359 | 53 ms | 82 ms | 88 ms | 0 |
| `GET /reportes/semana` (central) | 581 | 32 ms | 49 ms | 59 ms | 0 |
| `POST /auth/login` (10 conexiones) | 2,1 | 3.688 ms | 5.600 ms | 5.600 ms | 0 |

Ninguna solicitud falló en los 6 escenarios (más de 60.000 respuestas 2xx).

## Lectura

- Los listados y el panel responden en menos de 100 ms en el percentil 99 con 20 usuarios simultáneos. Un turno típico (decenas de usuarios por instalación) está muy por debajo de esa carga.
- **Cuello de botella: el login.** Un login aislado tarda cerca de 0,4 s porque `bcryptjs` (JavaScript puro, costo 12) ocupa el hilo principal. Con 10 logins simultáneos la latencia sube a más de 3 s y el resto de las peticiones esperan. Es un riesgo en horas de cambio de turno, cuando muchos guardias inician sesión a la vez.
- No se midió escritura masiva (marcaje y novedades con foto), ni red real, ni la base de producción.

## Mejoras propuestas (no aplicadas)

1. Cambiar `bcryptjs` por una implementación nativa (`bcrypt` o `argon2`), que corre fuera del hilo principal. Los hashes existentes de bcrypt siguen siendo compatibles.
2. Mantener el límite de peticiones específico para `/auth/login` (ya existe protección contra fuerza bruta en el 2FA).
3. Repetir esta medición con más datos y contra un entorno de pruebas en Azure antes de comprometer niveles de servicio.

## Medición de los KPI del informe (pendiente de ejecutar)

Los KPI "validación de geocerca < 3 s" y "alerta crítica < 5 s" **todavía no tienen medición propia**. El script `backend/scripts/medicion-kpi.js` los mide contra un entorno desplegado y guarda p50, p95 y p99 en `resultados-kpi/kpi-<fecha>.json` y `.md`. Los números que salgan son los únicos que se pueden citar; hasta entonces el informe no debe afirmar que se cumplen.

- **KPI-1 (geocerca):** tiempo de `POST /asistencia/entrada-fallback` (incluye validación Haversine, consultas y escritura), una entrada por guardia de prueba.
- **KPI-2 (alerta):** desde que el guardia envía una novedad roja hasta que el operador central recibe `alerta_critica_central` por Socket.IO (exige instalación con criticidad Alta).
- Mide desde el cliente, así que incluye la red. Con pocos guardias de prueba la muestra de KPI-1 es pequeña (el script lo avisa: p95 y p99 equivalen al máximo); para más muestras, usar más guardias de prueba con turno vigente.
- **Crea datos** (asistencias y novedades "[KPI]"): usar un entorno de pruebas o guardias de prueba, no producción real.

```bash
cd backend && npm ci
export KPI_API_URL=https://<api> KPI_LAT=<lat dentro de la geocerca> KPI_LON=<lon>
export KPI_GUARDIAS='rut1:clave1,rut2:clave2' KPI_CENTRAL_RUT=<rut> KPI_CENTRAL_PASSWORD=<clave>
node scripts/medicion-kpi.js --confirmo-datos-de-prueba --alertas 30
```

Contra el contenedor de Azure (0,5 vCPU, 0 a 1 réplicas) conviene correrlo dos veces: una en frío (réplica dormida) y otra en caliente, y reportar ambas por separado.
