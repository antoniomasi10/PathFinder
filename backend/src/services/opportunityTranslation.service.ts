import redis from '../lib/redis';
import { translateBatch } from './translation.service';

export async function translateOpportunities(opps: any[], lang: string): Promise<void> {
  if (lang === 'it' || opps.length === 0) return;

  const toTranslate: number[] = [];
  const titles: string[] = [];
  const descs: string[] = [];

  for (let i = 0; i < opps.length; i++) {
    const cached = await redis.get(`lt:${lang}:${opps[i].id}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        opps[i].title = parsed.title;
        opps[i].description = parsed.description;
      } catch {}
    } else {
      toTranslate.push(i);
      titles.push(opps[i].title || '');
      descs.push((opps[i].description || '').slice(0, 2000));
    }
  }

  if (toTranslate.length === 0) return;

  const [tTitles, tDescs] = await Promise.all([
    translateBatch(titles, lang),
    translateBatch(descs, lang),
  ]);

  for (let k = 0; k < toTranslate.length; k++) {
    const i = toTranslate[k];
    opps[i].title = tTitles[k];
    opps[i].description = tDescs[k];
    redis.set(
      `lt:${lang}:${opps[i].id}`,
      JSON.stringify({ title: tTitles[k], description: tDescs[k] }),
    ).catch(() => {});
  }
}
