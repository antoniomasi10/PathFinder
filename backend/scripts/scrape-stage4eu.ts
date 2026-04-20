/**
 * Manual Stage4eu scraper — run with: npm run scrape:stage4eu
 * Options: --max-pages=N  --max-details=N
 */
import { importStage4euOpportunities } from '../src/services/import/stage4eu.import';

const maxPages = parseInt(process.argv.find(a => a.startsWith('--max-pages='))?.split('=')[1] || '10');
const maxDetails = parseInt(process.argv.find(a => a.startsWith('--max-details='))?.split('=')[1] || '150');

console.log(`\n🔍 Starting Stage4eu scrape (max ${maxPages} pages, ${maxDetails} details)...\n`);

importStage4euOpportunities({ maxPages, maxDetails })
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
