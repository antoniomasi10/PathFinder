/**
 * Manual Workable scraper — run with: npm run scrape:workable
 */
import { importWorkableOpportunities } from '../src/services/import/workable.import';

console.log('\n🏢 Starting Workable scrape...\n');

importWorkableOpportunities()
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
