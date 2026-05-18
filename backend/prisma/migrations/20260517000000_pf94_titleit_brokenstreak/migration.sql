-- AlterTable
ALTER TABLE "Opportunity"
  ADD COLUMN "titleIt" TEXT,
  ADD COLUMN "descriptionIt" TEXT,
  ADD COLUMN "urlBrokenStreak" INTEGER NOT NULL DEFAULT 0;
