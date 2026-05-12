-- Fix incorrect isAbroad=true on FashionUnited opportunities in Italian cities.
-- Bug: isCountryAbroad('') returned true, marking all opportunities without
-- a country field as abroad. This corrects affected records by location text.

UPDATE "Opportunity"
SET "isAbroad" = false
WHERE source = 'fashionunited'
  AND "isAbroad" = true
  AND (
    location ILIKE '%milan%'    OR location ILIKE '%milano%'
    OR location ILIKE '%roma%'  OR location ILIKE '%rome%'
    OR location ILIKE '%torino%' OR location ILIKE '%turin%'
    OR location ILIKE '%napoli%' OR location ILIKE '%naples%'
    OR location ILIKE '%firenze%' OR location ILIKE '%florence%'
    OR location ILIKE '%bologna%'
    OR location ILIKE '%venezia%' OR location ILIKE '%venice%'
    OR location ILIKE '%genova%'  OR location ILIKE '%genoa%'
    OR location ILIKE '%italy%'   OR location ILIKE '%italia%'
    OR location IS NULL OR location = ''
  );
