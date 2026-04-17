-- DropIndex
DROP INDEX IF EXISTS "User_username_key";

-- AlterTable: remove username column from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "username";
