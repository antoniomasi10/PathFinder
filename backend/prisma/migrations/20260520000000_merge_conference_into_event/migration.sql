-- Merge CONFERENCE into EVENT: update all existing records first, then drop the enum value.

-- Step 1: migrate all CONFERENCE rows to EVENT
UPDATE "Opportunity" SET "type" = 'EVENT' WHERE "type" = 'CONFERENCE';

-- Step 2: recreate the enum without CONFERENCE
ALTER TYPE "OpportunityType" RENAME TO "OpportunityType_old";

CREATE TYPE "OpportunityType" AS ENUM (
  'STAGE',
  'INTERNSHIP',
  'EXTRACURRICULAR',
  'EVENT',
  'FELLOWSHIP',
  'SUMMER_PROGRAM',
  'HACKATHON',
  'COMPETITION',
  'EXCHANGE',
  'VOLUNTEERING',
  'BOOTCAMP',
  'RESEARCH'
);

ALTER TABLE "Opportunity"
  ALTER COLUMN "type" TYPE "OpportunityType"
  USING "type"::text::"OpportunityType";

DROP TYPE "OpportunityType_old";
