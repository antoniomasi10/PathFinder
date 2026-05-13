/**
 * Manual Mobilizon scraper — run with: npm run import:mobilizon
 */
import { importMobilizonOpportunities } from '../src/services/import/mobilizon.import';

console.log('\nStarting Mobilizon Italy community event import...\n');

importMobilizonOpportunities()
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
