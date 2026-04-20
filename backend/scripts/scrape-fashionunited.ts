/**
 * Manual FashionUnited scraper — run with: npm run scrape:fashionunited
 */
import { importFashionUnitedOpportunities } from '../src/services/import/fashionunited.import';

console.log('\n👗 Starting FashionUnited scrape...\n');

importFashionUnitedOpportunities()
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
