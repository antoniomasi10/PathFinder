-- AlterTable: add emailDaily preference to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN "emailDaily" BOOLEAN NOT NULL DEFAULT true;
