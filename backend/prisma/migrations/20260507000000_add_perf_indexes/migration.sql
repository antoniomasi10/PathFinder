-- Add missing performance indexes

-- PathMatesMessage: index on sentAt for ordering messages chronologically
CREATE INDEX "PathMatesMessage_sentAt_idx" ON "PathMatesMessage"("sentAt");

-- Notification: compound index on userId+createdAt for paginated notification queries
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- User: index on emailVerified for filtering unverified accounts
CREATE INDEX "User_emailVerified_idx" ON "User"("emailVerified");

-- User: index on role for admin queries
CREATE INDEX "User_role_idx" ON "User"("role");
