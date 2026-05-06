/**
 * Manual EURES scraper — run with: npm run scrape:eures
 * Optionally pass --max-pages=N to limit pages per query (default: 3)
 */
import { importOpportunities } from '../src/services/import/eures.import';

const maxPages = parseInt(process.argv.find(a => a.startsWith('--max-pages='))?.split('=')[1] || '3');

console.log(`\n🔍 Starting EURES scrape (max ${maxPages} pages per query)...\n`);

importOpportunities({ maxPages })
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
