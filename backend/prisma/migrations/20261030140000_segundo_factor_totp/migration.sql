-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_recovery" JSONB,
ADD COLUMN     "two_factor_ultimo_paso" INTEGER;
