/**
 * Manual developers.events scraper — run with: npm run import:developers-events
 */
import { importDevelopersEventsOpportunities } from '../src/services/import/developers-events.import';

console.log('\nStarting developers.events Italian conference import...\n');

importDevelopersEventsOpportunities()
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
