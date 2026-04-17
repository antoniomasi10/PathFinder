-- DropIndex
DROP INDEX "Course_embedding_idx";

-- DropIndex
DROP INDEX "Opportunity_embedding_idx";

-- DropIndex
DROP INDEX "User_embedding_idx";

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "recommendedSkills" TEXT,
ADD COLUMN     "requiredSkills" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "skills" JSONB NOT NULL DEFAULT '{"core":null,"side":[],"promptShownAt":null,"promptDismissedAt":null,"definedAt":null,"lastUpdatedAt":null}';
