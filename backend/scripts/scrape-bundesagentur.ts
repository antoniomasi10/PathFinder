/**
 * Manual Bundesagentur scraper — run with: npm run scrape:bundesagentur
 */
import { importBundesagenturOpportunities } from '../src/services/import/bundesagentur.import';

console.log('\n🇩🇪 Starting Bundesagentur für Arbeit scrape...\n');

importBundesagenturOpportunities()
  .then(result => {
    console.log('\n✅ Done!');
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Skipped:  ${result.skipped}`);
    console.log(`   Source:   ${result.source}\n`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
  });
