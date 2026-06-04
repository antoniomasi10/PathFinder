-- AlterTable: change defaults from 'Pathmates' to 'Tutti' for profile visibility fields
ALTER TABLE "User" ALTER COLUMN "privacySavedOpps" SET DEFAULT 'Tutti',
ALTER COLUMN "privacySkills" SET DEFAULT 'Tutti',
ALTER COLUMN "privacyPathmates" SET DEFAULT 'Tutti',
ALTER COLUMN "privacyUniversity" SET DEFAULT 'Tutti';

-- Update existing users that still have the old default values
UPDATE "User" SET
  "privacySavedOpps" = 'Tutti',
  "privacyPathmates" = 'Tutti',
  "privacySkills" = 'Tutti',
  "privacyUniversity" = 'Tutti'
WHERE
  "privacySavedOpps" = 'Pathmates'
  AND "privacyPathmates" = 'Pathmates'
  AND "privacySkills" = 'Pathmates'
  AND "privacyUniversity" = 'Pathmates';
