/**
 * Manual SmartRecruiters scraper — run with: npm run scrape:smartrecruiters
 */
import { importSmartRecruitersOpportunities } from '../src/services/import/smartrecruiters.import';

console.log('\n🌐 Starting SmartRecruiters scrape...\n');

importSmartRecruitersOpportunities()
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
