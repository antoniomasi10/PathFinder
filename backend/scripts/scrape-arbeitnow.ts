/**
 * Manual Arbeitnow scraper — run with: npm run scrape:arbeitnow
 */
import { importArbeitnowOpportunities } from '../src/services/import/arbeitnow.import';

console.log('\n🌍 Starting Arbeitnow scrape...\n');

importArbeitnowOpportunities()
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
