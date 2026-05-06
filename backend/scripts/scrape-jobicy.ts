/**
 * Manual Jobicy scraper — run with: npm run scrape:jobicy
 */
import { importJobicyOpportunities } from '../src/services/import/jobicy.import';

console.log('\n🌐 Starting Jobicy scrape...\n');

importJobicyOpportunities()
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
