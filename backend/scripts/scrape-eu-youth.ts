/**
 * Manual EU Youth Portal scraper — run with: npm run scrape:eu-youth
 * Options: --max-results=N (default: 1200)
 */
import { importEUOpportunities } from '../src/services/import/eu-youth.import';

const maxResults = parseInt(process.argv.find(a => a.startsWith('--max-results='))?.split('=')[1] || '1200');

console.log(`\n🇪🇺 Starting European Youth Portal scrape (max ${maxResults} results)...\n`);

importEUOpportunities({ maxResults })
  .then(result => {
    console.log('\n✅ Done!');
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Skipped:  ${result.skipped}`);
    console.log(`   Sources:  ${result.sources.join(', ')}\n`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Failed:', err);
    process.exit(1);
  });
