-- AlterTable: campo de comuna en Instalacion
ALTER TABLE "Instalacion" ADD COLUMN "comuna" TEXT;

-- AlterTable: array de comunas de cobertura en Usuario (supervisor)
ALTER TABLE "Usuario" ADD COLUMN "comunas_cobertura" JSONB;
