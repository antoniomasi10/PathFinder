/**
 * Manual RemoteOK scraper — run with: npm run scrape:remoteok
 */
import { importRemoteOKOpportunities } from '../src/services/import/remoteok.import';

console.log('\n🌐 Starting RemoteOK scrape...\n');

importRemoteOKOpportunities()
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
