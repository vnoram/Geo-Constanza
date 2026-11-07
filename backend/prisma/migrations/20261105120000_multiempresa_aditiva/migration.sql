-- MULTIEMPRESA, PASO 1 DE 2 — ADITIVO Y SEGURO PARA PRODUCCIÓN
--
-- Solo agrega: la tabla Empresa, columnas empresa_id NULLABLES, índices y el relleno de los
-- datos existentes con una empresa por defecto. No endurece nada ni borra nada, así que el
-- código anterior sigue funcionando si se corre solo esta migración.
-- El paso 2 (20261105130000_multiempresa_not_null) verifica que no queden NULL y recién
-- entonces deja las columnas obligatorias.

-- 1. Tabla de empresas
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'activa',
    "plan" TEXT NOT NULL DEFAULT 'estandar',
    "ultimo_folio" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Empresa_rut_key" ON "Empresa"("rut");

-- 2. Empresa por defecto: recibe TODOS los datos que ya existen (id fijo para poder referirla).
--    ultimo_folio parte en el mayor folio ya emitido, para que el contador continúe sin repetir.
--    Su RUT es un marcador: se corrige desde la consola de plataforma.
INSERT INTO "Empresa" ("id", "nombre", "rut", "estado", "plan", "ultimo_folio", "updated_at")
VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Empresa por defecto',
    '00000000-0',
    'activa',
    'estandar',
    COALESCE((SELECT MAX("numero") FROM "Novedad"), 0),
    CURRENT_TIMESTAMP
);

-- 3. Columna empresa_id NULLABLE en cada tabla operativa
ALTER TABLE "Usuario"                ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Instalacion"            ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Supervisor_Instalacion" ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Turno"                  ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Asistencia"             ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Novedad"                ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "NovedadHistorial"       ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Solicitud"              ADD COLUMN "empresa_id" TEXT;
ALTER TABLE "Auditoria"              ADD COLUMN "empresa_id" TEXT;

-- 4. Relleno: todo lo existente pasa a la empresa por defecto
UPDATE "Usuario"                SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Instalacion"            SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Supervisor_Instalacion" SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Turno"                  SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Asistencia"             SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Novedad"                SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "NovedadHistorial"       SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Solicitud"              SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;
UPDATE "Auditoria"              SET "empresa_id" = '00000000-0000-4000-8000-000000000001' WHERE "empresa_id" IS NULL;

-- 5. Índices por empresa (todas las consultas filtran por empresa_id)
CREATE INDEX "Usuario_empresa_id_idx"                ON "Usuario"("empresa_id");
CREATE INDEX "Instalacion_empresa_id_idx"            ON "Instalacion"("empresa_id");
CREATE INDEX "Supervisor_Instalacion_empresa_id_idx" ON "Supervisor_Instalacion"("empresa_id");
CREATE INDEX "Turno_empresa_id_idx"                  ON "Turno"("empresa_id");
CREATE INDEX "Asistencia_empresa_id_idx"             ON "Asistencia"("empresa_id");
CREATE INDEX "Novedad_empresa_id_idx"                ON "Novedad"("empresa_id");
CREATE INDEX "NovedadHistorial_empresa_id_idx"       ON "NovedadHistorial"("empresa_id");
CREATE INDEX "Solicitud_empresa_id_idx"              ON "Solicitud"("empresa_id");
CREATE INDEX "Auditoria_empresa_id_idx"              ON "Auditoria"("empresa_id");

-- 6. Unicidad (empresa_id, id): requisito de las claves foráneas compuestas del paso 2,
--    que impiden a nivel de base de datos que un registro apunte a otro de otra empresa.
CREATE UNIQUE INDEX "Usuario_empresa_id_id_key"     ON "Usuario"("empresa_id", "id");
CREATE UNIQUE INDEX "Instalacion_empresa_id_id_key" ON "Instalacion"("empresa_id", "id");
CREATE UNIQUE INDEX "Turno_empresa_id_id_key"       ON "Turno"("empresa_id", "id");
CREATE UNIQUE INDEX "Novedad_empresa_id_id_key"     ON "Novedad"("empresa_id", "id");

-- 7. Clave foránea hacia Empresa (las columnas aún admiten NULL; ver paso 2)
ALTER TABLE "Usuario"                ADD CONSTRAINT "Usuario_empresa_id_fkey"                FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Instalacion"            ADD CONSTRAINT "Instalacion_empresa_id_fkey"            FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supervisor_Instalacion" ADD CONSTRAINT "Supervisor_Instalacion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Turno"                  ADD CONSTRAINT "Turno_empresa_id_fkey"                  FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asistencia"             ADD CONSTRAINT "Asistencia_empresa_id_fkey"             FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Novedad"                ADD CONSTRAINT "Novedad_empresa_id_fkey"                FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NovedadHistorial"       ADD CONSTRAINT "NovedadHistorial_empresa_id_fkey"       FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Solicitud"              ADD CONSTRAINT "Solicitud_empresa_id_fkey"              FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Auditoria"              ADD CONSTRAINT "Auditoria_empresa_id_fkey"              FOREIGN KEY ("empresa_id") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
