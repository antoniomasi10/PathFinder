/**
 * Manual The Muse scraper — run with: npm run scrape:themuse
 */
import { importMuseOpportunities } from '../src/services/import/themuse.import';

console.log('\n🌍 Starting The Muse scrape...\n');

importMuseOpportunities()
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
