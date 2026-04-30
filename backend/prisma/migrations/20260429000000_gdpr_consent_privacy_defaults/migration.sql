-- GDPR: add consent tracking fields and apply privacy-by-default

-- Consent timestamps and marketing preference
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tosConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyConsentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsent" BOOLEAN NOT NULL DEFAULT false;

-- Privacy by default: change all visibility defaults from public to restricted
-- Existing users keep their current settings; defaults only affect new accounts.
ALTER TABLE "User" ALTER COLUMN "publicProfile" SET DEFAULT false;
ALTER TABLE "User" ALTER COLUMN "privacyPathmates" SET DEFAULT 'Pathmates';
ALTER TABLE "User" ALTER COLUMN "privacySkills" SET DEFAULT 'Pathmates';
ALTER TABLE "User" ALTER COLUMN "privacyUniversity" SET DEFAULT 'Pathmates';
