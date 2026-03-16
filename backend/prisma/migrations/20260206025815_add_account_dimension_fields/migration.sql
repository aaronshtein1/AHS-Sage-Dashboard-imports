-- AlterEnum
ALTER TYPE "ClosingType" ADD VALUE 'CLOSED_TO';

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "require_department" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "require_location" BOOLEAN NOT NULL DEFAULT false;
