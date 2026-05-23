-- AlterTable: add OneSignal email player ID to User
ALTER TABLE "User" ADD COLUMN "oneSignalEmailPlayerId" TEXT;

-- AlterTable: add emailSpot preference to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN "emailSpot" BOOLEAN NOT NULL DEFAULT true;
