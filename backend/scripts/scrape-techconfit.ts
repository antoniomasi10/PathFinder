/**
 * Manual TechConfit scraper — run with: npm run import:techconfit
 */
import { importTechConfitOpportunities } from '../src/services/import/techconfit.import';

console.log('\nStarting TechConfit Italian conference import...\n');

importTechConfitOpportunities()
  .then(result => {
    console.log('\nDone!');
    console.log(`   Imported: ${result.imported}`);
    console.log(`   Skipped:  ${result.skipped}`);
    console.log(`   Source:   ${result.source}\n`);
    process.exit(0);
  })
  .catch(err => {
    console.error('\nFailed:', err);
    process.exit(1);
  });
