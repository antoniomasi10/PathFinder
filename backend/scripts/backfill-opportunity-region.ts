// Usage: npx ts-node backend/scripts/backfill-opportunity-region.ts
// Rule-based: maps Opportunity.city → Italian region for rows where country='IT' (or isAbroad=false)
// and region IS NULL. No external API calls. Idempotent.

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';

const CITY_TO_REGION: Record<string, string> = {
  // Lombardia
  'milano': 'Lombardia', 'milan': 'Lombardia', 'bergamo': 'Lombardia', 'brescia': 'Lombardia',
  'como': 'Lombardia', 'pavia': 'Lombardia', 'varese': 'Lombardia', 'monza': 'Lombardia',
  'mantova': 'Lombardia', 'cremona': 'Lombardia', 'lecco': 'Lombardia', 'sondrio': 'Lombardia',
  'lodi': 'Lombardia',
  // Lazio
  'roma': 'Lazio', 'rome': 'Lazio', 'latina': 'Lazio', 'frosinone': 'Lazio', 'rieti': 'Lazio',
  'viterbo': 'Lazio',
  // Piemonte
  'torino': 'Piemonte', 'turin': 'Piemonte', 'novara': 'Piemonte', 'asti': 'Piemonte',
  'alessandria': 'Piemonte', 'cuneo': 'Piemonte', 'biella': 'Piemonte', 'vercelli': 'Piemonte',
  // Emilia-Romagna
  'bologna': 'Emilia-Romagna', 'modena': 'Emilia-Romagna', 'parma': 'Emilia-Romagna',
  'reggio emilia': 'Emilia-Romagna', 'reggio nell\'emilia': 'Emilia-Romagna',
  'rimini': 'Emilia-Romagna', 'ferrara': 'Emilia-Romagna', 'forlì': 'Emilia-Romagna',
  'forli': 'Emilia-Romagna', 'cesena': 'Emilia-Romagna', 'piacenza': 'Emilia-Romagna',
  'ravenna': 'Emilia-Romagna',
  // Campania
  'napoli': 'Campania', 'naples': 'Campania', 'salerno': 'Campania', 'caserta': 'Campania',
  'avellino': 'Campania', 'benevento': 'Campania',
  // Toscana
  'firenze': 'Toscana', 'florence': 'Toscana', 'pisa': 'Toscana', 'siena': 'Toscana',
  'lucca': 'Toscana', 'livorno': 'Toscana', 'arezzo': 'Toscana', 'pistoia': 'Toscana',
  'prato': 'Toscana', 'grosseto': 'Toscana', 'massa': 'Toscana', 'carrara': 'Toscana',
  // Puglia
  'bari': 'Puglia', 'lecce': 'Puglia', 'taranto': 'Puglia', 'foggia': 'Puglia',
  'brindisi': 'Puglia', 'andria': 'Puglia', 'barletta': 'Puglia', 'trani': 'Puglia',
  // Sicilia
  'palermo': 'Sicilia', 'catania': 'Sicilia', 'messina': 'Sicilia', 'siracusa': 'Sicilia',
  'ragusa': 'Sicilia', 'trapani': 'Sicilia', 'agrigento': 'Sicilia', 'caltanissetta': 'Sicilia',
  'enna': 'Sicilia',
  // Liguria
  'genova': 'Liguria', 'genoa': 'Liguria', 'la spezia': 'Liguria', 'savona': 'Liguria',
  'imperia': 'Liguria',
  // Veneto
  'venezia': 'Veneto', 'venice': 'Veneto', 'padova': 'Veneto', 'padua': 'Veneto',
  'verona': 'Veneto', 'vicenza': 'Veneto', 'treviso': 'Veneto', 'rovigo': 'Veneto',
  'belluno': 'Veneto',
  // Friuli-Venezia Giulia
  'trieste': 'Friuli-Venezia Giulia', 'udine': 'Friuli-Venezia Giulia',
  'pordenone': 'Friuli-Venezia Giulia', 'gorizia': 'Friuli-Venezia Giulia',
  // Trentino-Alto Adige
  'trento': 'Trentino-Alto Adige', 'bolzano': 'Trentino-Alto Adige',
  // Calabria
  'cosenza': 'Calabria', 'catanzaro': 'Calabria', 'reggio calabria': 'Calabria',
  'crotone': 'Calabria', 'vibo valentia': 'Calabria',
  // Sardegna
  'cagliari': 'Sardegna', 'sassari': 'Sardegna', 'nuoro': 'Sardegna', 'oristano': 'Sardegna',
  'olbia': 'Sardegna',
  // Marche
  'ancona': 'Marche', 'pesaro': 'Marche', 'macerata': 'Marche', 'fermo': 'Marche',
  'ascoli piceno': 'Marche',
  // Abruzzo
  'l\'aquila': 'Abruzzo', 'laquila': 'Abruzzo', 'pescara': 'Abruzzo', 'teramo': 'Abruzzo',
  'chieti': 'Abruzzo',
  // Molise
  'campobasso': 'Molise', 'isernia': 'Molise',
  // Basilicata
  'potenza': 'Basilicata', 'matera': 'Basilicata',
  // Umbria
  'perugia': 'Umbria', 'terni': 'Umbria',
  // Valle d'Aosta
  'aosta': 'Valle d\'Aosta',
};

function resolveRegion(city: string | null): string | null {
  if (!city) return null;
  const key = city.trim().toLowerCase();
  if (CITY_TO_REGION[key]) return CITY_TO_REGION[key];
  // Try first token (e.g. "Milano, IT" → "milano")
  const first = key.split(/[,\s/-]/)[0].trim();
  return CITY_TO_REGION[first] ?? null;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ id: string; city: string | null }[]>(
    `SELECT id, city FROM "Opportunity"
     WHERE region IS NULL
       AND (country = 'IT' OR (country IS NULL AND "isAbroad" = false))
       AND city IS NOT NULL AND city <> ''`,
  );
  console.log(`[backfill-region] candidates: ${rows.length}`);

  let updated = 0;
  let unmatched = 0;
  const unmatchedCities = new Map<string, number>();

  for (const row of rows) {
    const region = resolveRegion(row.city);
    if (region) {
      await prisma.opportunity.update({ where: { id: row.id }, data: { region } });
      updated++;
    } else {
      unmatched++;
      const key = (row.city ?? '').trim().toLowerCase();
      unmatchedCities.set(key, (unmatchedCities.get(key) ?? 0) + 1);
    }
  }

  console.log(`[backfill-region] updated: ${updated}, unmatched: ${unmatched}`);
  if (unmatched > 0) {
    const top = [...unmatchedCities.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    console.log('[backfill-region] top unmatched cities:');
    for (const [city, count] of top) console.log(`  ${city}: ${count}`);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[backfill-region] error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
