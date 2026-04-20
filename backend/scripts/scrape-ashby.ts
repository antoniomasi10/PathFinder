/**
 * Manual Ashby scraper — run with: npm run scrape:ashby
 */
import { importAshbyOpportunities } from '../src/services/import/ashby.import';

console.log('\n🏢 Starting Ashby scrape...\n');

importAshbyOpportunities()
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
