-- AlterTable: add surname, username, phone fields to User
ALTER TABLE "User"
ADD COLUMN "surname" TEXT NOT NULL DEFAULT '',
ADD COLUMN "username" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
