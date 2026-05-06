/**
 * Manual Personio scraper — run with: npm run scrape:personio
 */
import { importPersonioOpportunities } from '../src/services/import/personio.import';

console.log('\n🏢 Starting Personio scrape...\n');

importPersonioOpportunities()
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
