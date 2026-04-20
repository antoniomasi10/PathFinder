/**
 * Manual Lever scraper — run with: npm run scrape:lever
 */
import { importLeverOpportunities } from '../src/services/import/lever.import';

console.log('\n🏢 Starting Lever scrape...\n');

importLeverOpportunities()
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
