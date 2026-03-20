-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'OPPORTUNITY_DEADLINE';
ALTER TYPE "NotificationType" ADD VALUE 'COURSE_DEADLINE';
ALTER TYPE "NotificationType" ADD VALUE 'COURSE_RECOMMENDED';
ALTER TYPE "NotificationType" ADD VALUE 'BADGE_UNLOCKED';
ALTER TYPE "NotificationType" ADD VALUE 'POST_LIKE';
ALTER TYPE "NotificationType" ADD VALUE 'POST_COMMENT';
ALTER TYPE "NotificationType" ADD VALUE 'COMMENT_REPLY';
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'SYSTEM';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "data" JSONB,
ADD COLUMN     "icon" TEXT;
