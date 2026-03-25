-- AlterTable: Add V2 algorithm fields to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN "requirements" JSONB;
ALTER TABLE "Opportunity" ADD COLUMN "careerOutcomes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Opportunity" ADD COLUMN "tier" TEXT;

-- AlterTable: Add V2 algorithm fields to UserProfile
ALTER TABLE "UserProfile" ADD COLUMN "gpa" DOUBLE PRECISION;
ALTER TABLE "UserProfile" ADD COLUMN "gpaScale" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "languageLevel" TEXT;
ALTER TABLE "UserProfile" ADD COLUMN "careerGoals" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserProfile" ADD COLUMN "experiences" JSONB[] DEFAULT ARRAY[]::JSONB[];
ALTER TABLE "UserProfile" ADD COLUMN "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "UserProfile" ADD COLUMN "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[];
