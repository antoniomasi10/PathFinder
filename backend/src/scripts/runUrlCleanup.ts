/**
 * One-shot URL cleanup: checks ALL opportunities (including curated) for broken links.
 * Run before release to immediately clean the DB.
 *
 * Usage: npx ts-node --transpile-only src/scripts/runUrlCleanup.ts
 *
 * 403/429 → SKIP (anti-bot, not a signal the job is gone)
 * 404/410 → BROKEN (definitively gone, hidden from feed)
 * Other errors → SKIP (retry later)
 */

import { runUrlCheckBatch } from '../services/import/urlChecker';
import prisma from '../lib/prisma';

async function main() {
  console.log('[runUrlCleanup] Starting one-shot URL cleanup (all sources including curated)...');

  // Run in batches of 200 to avoid hammering servers
  let totalChecked = 0, totalBroken = 0, totalActive = 0;
  let round = 0;

  while (true) {
    round++;
    console.log(`\n[runUrlCleanup] Round ${round}...`);
    const result = await runUrlCheckBatch(200);
    totalChecked += result.checked;
    totalBroken += result.broken;
    totalActive += result.active;

    console.log(`  checked=${result.checked} active=${result.active} broken=${result.broken} skipped=${result.skipped}`);

    // Stop when no more unchecked opportunities remain
    if (result.checked === 0) break;
    // Safety cap at 2000 total
    if (totalChecked >= 2000) { console.log('[runUrlCleanup] Safety cap reached, stopping.'); break; }
  }

  console.log(`\n[runUrlCleanup] Done. Total: checked=${totalChecked} active=${totalActive} broken=${totalBroken}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
