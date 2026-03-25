-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyUniversity" TEXT NOT NULL DEFAULT 'Tutti';
