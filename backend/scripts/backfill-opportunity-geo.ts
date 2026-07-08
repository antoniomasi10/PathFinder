// Usage: npx ts-node backend/scripts/backfill-opportunity-geo.ts [--limit=N]
//
// One-time geo backfill (PF-118 Fase 0, Step 0.4): re-derives country/region/city
// for Opportunity rows with country IS NULL, using the same rule-based extractors
// importers already use (extractCountryCode + mapItalianRegion) against
// location/organizer/company/title. Idempotent — safe to re-run.
//
// Residuals that stay ambiguous after the rule-based pass get a small LLM
// fallback batch (gpt-4o-mini, JSON output) — skipped entirely if
// OPENAI_API_KEY is not set.

import * as dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import prisma from '../src/lib/prisma';
import { extractCountryCode } from '../src/services/import/utils';
import { mapItalianRegion } from '../src/services/import/geo-italy';

const LLM_BATCH_SIZE = 20;
const LLM_CONCURRENCY = 3;

function parseLimit(): number | undefined {
  const arg = process.argv.find(a => a.startsWith('--limit='));
  return arg ? Number(arg.split('=')[1]) : undefined;
}

interface Candidate {
  id: string;
  title: string;
  location: string | null;
  organizer: string | null;
  company: string | null;
  city: string | null;
  isAbroad: boolean;
}

/** Best-effort country guess from every free-text field we have, in order of trust. */
function guessCountry(row: Candidate): string {
  const fields = [row.location, row.city, row.organizer, row.company];
  for (const f of fields) {
    if (!f) continue;
    const code = extractCountryCode(f);
    if (code) return code;
  }
  return '';
}

async function ruleBasedPass(limit?: number): Promise<{ resolved: number; residual: Candidate[] }> {
  const rows = await prisma.$queryRawUnsafe<Candidate[]>(`
    SELECT id, title, location, organizer, company, city, "isAbroad"
    FROM "Opportunity"
    WHERE country IS NULL
    ${limit ? `LIMIT ${Number(limit)}` : ''}
  `);
  console.log(`[backfill-geo] candidates: ${rows.length}`);

  let resolved = 0;
  const residual: Candidate[] = [];

  for (const row of rows) {
    const country = guessCountry(row);
    if (!country) {
      residual.push(row);
      continue;
    }

    const data: { country: string; region?: string; city?: string } = { country };
    if (country === 'IT') {
      const geo = mapItalianRegion(row.city ?? row.location);
      if (geo) {
        data.region = geo.region;
        if (!row.city) data.city = geo.canonicalCity;
      }
    }

    await prisma.opportunity.update({ where: { id: row.id }, data });
    resolved++;
  }

  console.log(`[backfill-geo] rule-based resolved: ${resolved} (country=IT: rechecked via mapItalianRegion)`);
  console.log(`[backfill-geo] residual after rule-based pass: ${residual.length}`);
  return { resolved, residual };
}

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

async function llmGuessCountry(client: OpenAI, row: Candidate): Promise<string | null> {
  const userContent = [
    `Titolo: ${row.title}`,
    row.organizer ? `Organizzatore: ${row.organizer}` : null,
    row.company ? `Azienda: ${row.company}` : null,
    row.location ? `Luogo: ${row.location}` : null,
    row.city ? `Città: ${row.city}` : null,
    `In estero (isAbroad): ${row.isAbroad}`,
  ].filter(Boolean).join('\n');

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Deduci il paese (codice ISO-3166-1 alpha-2, es. "IT", "DE", "US") a cui si riferisce questa opportunità, '
            + 'basandoti su titolo/organizzatore/azienda/luogo. Rispondi SOLO con JSON: {"country": "XX"} oppure {"country": null} se non deducibile.',
        },
        { role: 'user', content: userContent },
      ],
      max_tokens: 20,
      temperature: 0,
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const code = typeof parsed.country === 'string' ? parsed.country.trim().toUpperCase() : null;
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch (err) {
    console.warn(`[backfill-geo] LLM fallback failed for "${row.title}": ${err}`);
    return null;
  }
}

async function llmFallbackPass(residual: Candidate[]): Promise<number> {
  const client = getClient();
  if (!client) {
    console.log('[backfill-geo] OPENAI_API_KEY not set — skipping LLM fallback for residual rows');
    return 0;
  }

  let resolved = 0;
  for (let i = 0; i < residual.length; i += LLM_BATCH_SIZE) {
    const batch = residual.slice(i, i + LLM_BATCH_SIZE);
    for (let j = 0; j < batch.length; j += LLM_CONCURRENCY) {
      const chunk = batch.slice(j, j + LLM_CONCURRENCY);
      await Promise.all(chunk.map(async (row) => {
        const country = await llmGuessCountry(client, row);
        if (!country) return;
        const data: { country: string; region?: string; city?: string } = { country };
        if (country === 'IT') {
          const geo = mapItalianRegion(row.city ?? row.location);
          if (geo) {
            data.region = geo.region;
            if (!row.city) data.city = geo.canonicalCity;
          }
        }
        await prisma.opportunity.update({ where: { id: row.id }, data });
        resolved++;
      }));
    }
    console.log(`[backfill-geo] LLM fallback progress: ${Math.min(i + LLM_BATCH_SIZE, residual.length)}/${residual.length}`);
  }
  return resolved;
}

async function main() {
  const limit = parseLimit();
  const { resolved: ruleResolved, residual } = await ruleBasedPass(limit);
  const llmResolved = await llmFallbackPass(residual);

  const stillNull = residual.length - llmResolved;
  console.log(`[backfill-geo] done. rule-based: ${ruleResolved}, LLM: ${llmResolved}, still unresolved: ${stillNull}`);

  const itCount = await prisma.opportunity.count({ where: { country: 'IT' } });
  console.log(`[backfill-geo] total country=IT after backfill: ${itCount}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[backfill-geo] error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
