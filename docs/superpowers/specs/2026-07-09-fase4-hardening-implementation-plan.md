# Fase 4 — Hardening — Implementation Plan

**Date:** 2026-07-09
**Branch:** PF-118
**Spec:** `2026-07-09-fase4-hardening-design.md`

## Step 1 — Fix `ALL_SOURCES` gap

**File:** `backend/src/services/import/cleanup.service.ts`

Add to `ALL_SOURCES` (after `anpal`):
```ts
{ key: 'devfolio', prefix: 'devfolio-', schedule: 'Tue 04:45' },
{ key: 'msca', prefix: 'msca-', schedule: 'Mon 05:00' },
{ key: 'harvest-discovery', prefix: null, schedule: 'Mon 03:00' }, // produces HarvestTarget rows, not Opportunity
{ key: 'harvest-feeds', prefix: 'harvest-', schedule: 'Tue 05:00' },
```
`ALL_SOURCES`'s type gains `prefix: string | null`. In `getSourceHealthStats()`, the
`prisma.opportunity.count({ where: { sourceId: { startsWith: prefix } } })` call becomes
conditional: `prefix === null ? Promise.resolve(0) : prisma.opportunity.count(...)`. Note
`harvest-feeds` and the `scrapeWorker`-drained HarvestTarget records both use `sourceId`
prefixed `harvest-` (see `discovery/extraction.ts`/`harvest-feed-runner.ts`), so one prefix
covers both html-* (queue) and structured (direct) paths — they share the same `ImportLog`
source key too? **Check before writing**: `scrapeWorker.ts`'s `scrapeHarvestTarget` doesn't
create its own `ImportLog` row (unlike `harvest-feed-runner.ts`) — it's driven by the
`queue/drain` route's own `ImportLog`-free flow (same as CompanyWatchlist tier B/C, which
also has no per-run `ImportLog` — health for that path already relies on `ScrapeJob`/
`HarvestTarget.lastScrapeStatus`, not `ImportLog`). So `harvest-discovery`/`harvest-feeds`
entries reflect only the `runHarvestDiscovery()`/`runHarvestFeeds()` `ImportLog` rows
(both already created, confirmed in the code) — consistent with how `company-watchlist`
entry already works today for the same reason.

## Step 2 — Consolidate OpenAI clients

**New file:** `backend/src/services/ai/openai-client.ts`
```ts
import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}
```
Delete the three duplicate `_client`/`getClient()` definitions in `opportunityParser.ts`,
`clusterClassifier.ts`, `company-watchlist.import.ts`; import `getClient` from the new
module instead (re-export from `company-watchlist.import.ts` unchanged — `discovery/
extraction.ts` already imports `getClient` from there, no need to touch that import site).

## Step 3 — `LlmUsageLog` + `trackedCompletion`

**Migration** — add to `schema.prisma`:
```prisma
model LlmUsageLog {
  id               String   @id @default(cuid())
  source           String
  purpose          String
  model            String
  promptTokens     Int
  completionTokens Int
  totalTokens      Int
  createdAt        DateTime @default(now())

  @@index([source, createdAt])
  @@index([createdAt])
}
```
Same non-interactive migration flow as Fase 3 (`migrate diff --script` → hand-create
migration folder → `migrate deploy` → `prisma generate`).

**`openai-client.ts`** — add:
```ts
export interface CompletionContext { source: string; purpose: string }

export async function trackedCompletion(
  client: OpenAI,
  params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  ctx: CompletionContext,
): Promise<OpenAI.Chat.ChatCompletion> {
  const response = await client.chat.completions.create(params);
  const usage = response.usage;
  if (usage) {
    prisma.llmUsageLog.create({
      data: {
        source: ctx.source, purpose: ctx.purpose, model: params.model,
        promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      },
    }).catch(err => logger.warn(`[LlmUsage] log failed: ${err}`)); // fire-and-forget, never blocks the caller
  }
  return response;
}
```
Errors from `chat.completions.create` propagate unchanged (no try/catch here) — every call
site already has its own error handling; `trackedCompletion` only adds logging on success,
matching the design's "no change to existing error-handling flow" decision.

**Wire into all 9 call sites** (mechanical: `client.chat.completions.create({...})` →
`trackedCompletion(client, {...}, { source: '...', purpose: '...' })`):

| File | Function | `purpose` |
|---|---|---|
| `opportunityParser.ts` | `callLLM` (used by `parseOpportunityContent`) | `content-parse` |
| `opportunityParser.ts` | `extractDeadlineFromText` | `deadline-extract` |
| `opportunityParser.ts` | `extractOpportunitySkills` | `skill-extract` |
| `opportunityParser.ts` | `extractContextualizedSkills` | `contextualized-skills` |
| `opportunityParser.ts` | `extractRequiredLanguages` | `language-extract` |
| `opportunityParser.ts` | `translateOpportunityToItalian` | `translate-it` |
| `clusterClassifier.ts` | its single call site | `cluster-classify` |
| `company-watchlist.import.ts` | `extractOpportunitiesWithLLM` | `job-listing-extract` |
| `discovery/extraction.ts` | `extractOpportunitiesFromPage` | `harvest-extract` |

`source` for the five `batchUpsertOpportunities()`-internal calls (all of
`opportunityParser.ts` + `clusterClassifier.ts`) is `'opportunity-enrichment'` — they run
per-record regardless of which importer produced the record, so attributing them to the
originating importer isn't available at that call depth without threading it through every
importer (YAGNI — the design doc already flags this as the dominant cost driver *as a
category*, not per-importer). `company-watchlist.import.ts`/`discovery/extraction.ts` use
their own source key (`'company-watchlist'`/`'harvest-extraction'`) since they already know it.

## Step 4 — `GET /import/llm-cost`

**File:** `backend/src/services/import/cleanup.service.ts` (or a new
`services/ai/usage-report.ts` if `cleanup.service.ts` is getting crowded — decide when
writing, lean toward the new file since this isn't cleanup-related)
```ts
const OPENAI_PRICING: Record<string, { promptPer1M: number; completionPer1M: number }> = {
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.60 }, // update if OpenAI repricing
};

export async function getLlmCostReport() {
  // groupBy source+purpose, SUM tokens, for now/24h/7d/30d windows; estimate cost via OPENAI_PRICING per model
}
```
Route: `GET /import/llm-cost` in `import.routes.ts`, same admin-auth pattern as
`/import/coverage`.

## Step 5 — Dedup quality audit

**File:** `cleanup.service.ts`, new `findDedupCandidates(threshold = 0.93, limit = 200)`
using the raw SQL from the design spec §C (self-join on `Opportunity`, cosine similarity via
pgvector `<=>`, `dedupKey IS DISTINCT FROM`, live rows only, both sides have `embedding`).
Route: `GET /import/dedup-audit?threshold=&limit=` (admin), returns the candidate pairs —
read-only, no mutation.

## Testing

- Unit: `trackedCompletion` with a mocked OpenAI client (verifies `LlmUsageLog.create`
  called with the response's usage fields; verifies errors from `create()` propagate and
  skip logging).
- Unit: `OPENAI_PRICING` lookup — known model, unknown model fallback (return null cost
  estimate rather than throwing or guessing a price).
- Unit: `findDedupCandidates` with prisma `$queryRawUnsafe` mocked — verifies the threshold
  param is used, shape of returned pairs.
- Integration: `getSourceHealthStats()` with the four new `ALL_SOURCES` entries, including
  the `prefix: null` case (`harvest-discovery`) — must not throw, must return `recordCount:
  0` for it.
- Manual: trigger MSCA import (already has one real OpenAI-free run, but
  `opportunity-enrichment` calls fire regardless) → `GET /import/llm-cost` shows non-zero
  rows for `opportunity-enrichment`; `GET /import/dedup-audit` against the real dev DB →
  inspect returned pairs by hand.

## Modifiche allo schema

- **Nuovo modello** `LlmUsageLog` (Step 3). Nessuna modifica ad altri modelli.
