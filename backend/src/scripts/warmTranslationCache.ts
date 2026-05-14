/**
 * Pre-warms the Redis translation cache for all active opportunities.
 * Run periodically via cron: docker exec coha-backend node dist/src/scripts/warmTranslationCache.js
 *
 * Translates titles + descriptions for ES, FR, ZH (EN is already in DB).
 * Skips opportunities already cached. Safe to run multiple times.
 */

import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { translateBatch } from '../services/translation.service';

const LANGS = ['es', 'fr', 'zh'] as const;
const BATCH_DB = 100; // fetch from DB in pages of 100

async function warmLang(lang: string, ids: string[], titles: string[], descs: string[]) {
  const toTranslate: number[] = [];
  const tTitles: string[] = [];
  const tDescs: string[] = [];

  for (let i = 0; i < ids.length; i++) {
    const cached = await redis.get(`lt:${lang}:${ids[i]}`);
    if (!cached) {
      toTranslate.push(i);
      tTitles.push(titles[i]);
      tDescs.push(descs[i]);
    }
  }

  if (toTranslate.length === 0) return 0;

  const [translatedTitles, translatedDescs] = await Promise.all([
    translateBatch(tTitles, lang),
    translateBatch(tDescs, lang),
  ]);

  await Promise.all(
    toTranslate.map((i, k) =>
      redis
        .set(
          `lt:${lang}:${ids[i]}`,
          JSON.stringify({ title: translatedTitles[k], description: translatedDescs[k] }),
        )
        .catch(() => {}),
    ),
  );

  return toTranslate.length;
}

async function main() {
  console.log(`[warm] Starting translation cache warm-up — ${new Date().toISOString()}`);

  let page = 0;
  let total = 0;
  let translated = 0;

  while (true) {
    const opps = await prisma.opportunity.findMany({
      where: {
        AND: [
          { OR: [{ urlStatus: null }, { urlStatus: { not: 'BROKEN' } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          { OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
        ],
      },
      select: { id: true, title: true, description: true },
      skip: page * BATCH_DB,
      take: BATCH_DB,
      orderBy: { postedAt: 'desc' },
    });

    if (opps.length === 0) break;
    total += opps.length;
    page++;

    const ids = opps.map(o => o.id);
    const titles = opps.map(o => o.title || '');
    const descs = opps.map(o => (o.description || '').slice(0, 2000));

    for (const lang of LANGS) {
      const count = await warmLang(lang, ids, titles, descs);
      if (count > 0) {
        translated += count;
        console.log(`[warm] ${lang}: +${count} (page ${page}, total translated: ${translated})`);
      }
    }
  }

  console.log(`[warm] Done. Checked ${total} opportunities, translated ${translated} new entries.`);
  await prisma.$disconnect();
  await redis.quit();
}

main().catch(err => {
  console.error('[warm] Fatal error:', err);
  process.exit(1);
});
