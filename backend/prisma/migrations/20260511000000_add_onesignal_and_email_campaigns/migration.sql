-- AlterTable: add oneSignalPlayerId to User
ALTER TABLE "User" ADD COLUMN "oneSignalPlayerId" TEXT;

-- AlterTable: add email campaign prefs to NotificationPreference
ALTER TABLE "NotificationPreference" ADD COLUMN "emailDigest" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "NotificationPreference" ADD COLUMN "emailAlerts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: EmailLog
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekNumber" INTEGER,
    "year" INTEGER,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "EmailLog_userId_type_weekNumber_year_idx" ON "EmailLog"("userId", "type", "weekNumber", "year");
CREATE INDEX "EmailLog_userId_type_sentAt_idx" ON "EmailLog"("userId", "type", "sentAt");
