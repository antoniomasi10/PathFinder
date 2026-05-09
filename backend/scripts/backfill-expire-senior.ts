/**
 * Retroactively expires senior job postings that were imported before the
 * isSeniorRole filter was in place.
 *
 * Two-pass strategy:
 *   Pass 1 — Title keyword filter (free, instant): marks obvious senior roles
 *   Pass 2 — AI description check (paid, thorough): catches "4+ years required" in body
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/backfill-expire-senior.ts
 *
 * Safe to run multiple times — only targets INTERNSHIP/STAGE with expiresAt IS NULL.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/lib/prisma';
import { isSeniorRole } from '../src/services/import/utils';
import { extractDeadlineFromText } from '../src/services/ai/opportunityParser';
import OpenAI from 'openai';

const BATCH_SIZE = 50;
const AI_CONCURRENCY = 3;
const AI_CHUNK_DELAY_MS = 700;

type OppRow = { id: string; title: string; description: string; about: string | null };

const YEARS_PROMPT = `Analizza questa offerta di lavoro. Estrai il numero minimo di anni di esperienza lavorativa richiesti esplicitamente.
Rispondi SOLO con JSON: { "minYears": <numero intero> } oppure { "minYears": null } se è un ruolo entry-level o non è specificata esperienza.`;

async function extractMinYears(client: OpenAI, title: string, description: string): Promise<number | null> {
  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: YEARS_PROMPT },
        { role: 'user', content: `Titolo: ${title}\n\nDescrizione:\n${description.slice(0, 800)}` },
      ],
      max_tokens: 30,
      temperature: 0.1,
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { minYears?: number | null };
    return typeof parsed.minYears === 'number' ? Math.round(parsed.minYears) : null;
  } catch {
    return null;
  }
}

async function main() {
  // ── Pass 1: Title keyword filter (free) ──────────────────────────────────
  console.log('\n=== Pass 1: Title keyword filter ===');

  const allEntryLevel = await prisma.$queryRaw<OppRow[]>`
    SELECT id, title, description, about
    FROM "Opportunity"
    WHERE type IN ('INTERNSHIP', 'STAGE')
      AND "expiresAt" IS NULL
  `;

  let keywordExpired = 0;
  const now = new Date();
  for (const opp of allEntryLevel) {
    if (isSeniorRole(opp.title)) {
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { expiresAt: now },
      }).catch(() => {});
      keywordExpired++;
    }
  }
  console.log(`Pass 1 done: expired ${keywordExpired} senior roles via title filter`);

  // ── Pass 2: AI description check (paid) ──────────────────────────────────
  console.log('\n=== Pass 2: AI description check ===');

  if (!process.env.OPENAI_API_KEY) {
    console.log('OPENAI_API_KEY not set — skipping AI pass');
    await prisma.$disconnect();
    return;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Only check opportunities with substantial descriptions (>200 chars)
  const [{ count }] = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint as count
    FROM "Opportunity"
    WHERE type IN ('INTERNSHIP', 'STAGE')
      AND "expiresAt" IS NULL
      AND LENGTH(description) > 200
  `;
  const total = Number(count);
  console.log(`Found ${total} opportunities to AI-check`);

  if (total === 0) {
    console.log('Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  let processed = 0;
  let aiExpired = 0;
  let lastId = '';

  while (processed < total) {
    const batch: OppRow[] = lastId
      ? await prisma.$queryRaw`
          SELECT id, title, description, about
          FROM "Opportunity"
          WHERE type IN ('INTERNSHIP', 'STAGE')
            AND "expiresAt" IS NULL
            AND LENGTH(description) > 200
            AND id > ${lastId}
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `
      : await prisma.$queryRaw`
          SELECT id, title, description, about
          FROM "Opportunity"
          WHERE type IN ('INTERNSHIP', 'STAGE')
            AND "expiresAt" IS NULL
            AND LENGTH(description) > 200
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        `;

    if (batch.length === 0) break;

    for (let i = 0; i < batch.length; i += AI_CONCURRENCY) {
      const chunk = batch.slice(i, i + AI_CONCURRENCY);
      await Promise.all(
        chunk.map(async (opp) => {
          const minYears = await extractMinYears(client, opp.title, opp.description);
          if (minYears !== null && minYears >= 2) {
            await prisma.opportunity.update({
              where: { id: opp.id },
              data: { expiresAt: new Date() },
            }).catch(() => {});
            aiExpired++;
            console.log(`  Expired: "${opp.title}" (${minYears} yrs required)`);
          }
        }),
      );
      if (i + AI_CONCURRENCY < batch.length) {
        await new Promise(r => setTimeout(r, AI_CHUNK_DELAY_MS));
      }
    }

    processed += batch.length;
    lastId = batch[batch.length - 1].id;
    console.log(`Progress: ${processed}/${total} — AI expired so far: ${aiExpired}`);
  }

  console.log(`\nDone. Title filter: ${keywordExpired} expired. AI filter: ${aiExpired} expired. Total: ${keywordExpired + aiExpired}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
