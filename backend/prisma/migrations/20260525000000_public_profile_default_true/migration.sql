-- Set all existing users to public
UPDATE "User" SET "publicProfile" = true;

-- Change the column default for new users
ALTER TABLE "User" ALTER COLUMN "publicProfile" SET DEFAULT true;
