/**
 * Manual Greenhouse scraper — run with: npm run scrape:greenhouse
 */
import { importGreenhouseOpportunities } from '../src/services/import/greenhouse.import';

console.log('\n🏢 Starting Greenhouse scrape...\n');

importGreenhouseOpportunities()
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
