# Dynamic Friend Suggestions — Implementation Plan

**Date:** 2026-05-25  
**Branch:** PF-104  
**Spec:** `2026-05-25-dynamic-friend-suggestions-design.md`

## Overview

Single file change: `backend/src/services/similarity.service.ts`.  
Add Redis seen-set logic to `getSmartFriendSuggestions`. No DB migrations, no frontend changes, no route changes.

## Steps

### Step 1 — Add Redis import to `similarity.service.ts`

Import the `redis` singleton at the top of the file:

```ts
import redis from '../lib/redis';
```

**File:** `backend/src/services/similarity.service.ts`  
**Where:** after existing imports

---

### Step 2 — Add `SEEN_SET_TTL` constant

```ts
const SEEN_SET_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
```

**Where:** after existing imports, alongside any other module-level constants.

---

### Step 3 — Add `getSuggestionSeenSet` helper

A small private helper that loads the seen set from Redis and returns a `Set<string>`:

```ts
async function getSuggestionSeenSet(userId: string): Promise<Set<string>> {
  try {
    const members = await redis.smembers(`suggestions:seen:${userId}`);
    return new Set(members);
  } catch {
    return new Set();
  }
}
```

**Where:** bottom of the file, before `getVectorSimilarUsers`.

---

### Step 4 — Add `updateSuggestionSeenSet` helper

Adds returned IDs to the seen set and refreshes the TTL:

```ts
async function updateSuggestionSeenSet(userId: string, shownIds: string[]): Promise<void> {
  if (shownIds.length === 0) return;
  try {
    const key = `suggestions:seen:${userId}`;
    await redis.sadd(key, ...shownIds);
    await redis.expire(key, SEEN_SET_TTL);
  } catch {
    // non-fatal — suggestion rotation degrades gracefully
  }
}
```

**Where:** immediately after `getSuggestionSeenSet`.

---

### Step 5 — Modify `getSmartFriendSuggestions` — insert seen-set logic after scoring

Inside `getSmartFriendSuggestions`, after the `scored.sort(...)` line and before `return scored.slice(0, limit)`, replace the final return with:

```ts
// Load seen set and split candidates
const seenSet = await getSuggestionSeenSet(userId);
const unseen = scored.filter((c) => !seenSet.has(c.id));
const seen = scored.filter((c) => seenSet.has(c.id));

let result: typeof scored;
if (unseen.length >= limit) {
  // Enough unseen candidates — serve from unseen pool only
  result = unseen.slice(0, limit);
} else {
  // Pool exhausted — reset cycle and return top N from full pool
  try { await redis.del(`suggestions:seen:${userId}`); } catch {}
  result = scored.slice(0, limit);
}

await updateSuggestionSeenSet(userId, result.map((r) => r.id));
return result;
```

**Note:** `scored` is already sorted by score desc before this block. `seen` is computed but only used implicitly via `scored` on reset — no need to reference it directly.

---

### Step 6 — Apply same change to `getRandomSuggestions`

The random fallback (no profile) also returns a static list. Apply a simpler version: shuffle the candidate list before slicing.

In `getRandomSuggestions`, replace:
```ts
take: limit,
```
with:
```ts
take: limit * 3,  // fetch more to allow shuffling
```

And replace the final return:
```ts
return users.map((u) => ({ ...u, similarityScore: 0 }));
```
with:
```ts
const shuffled = users
  .map((u) => ({ ...u, similarityScore: 0 }))
  .sort(() => Math.random() - 0.5);
return shuffled.slice(0, limit);
```

This is intentionally simpler — random users don't need the seen-set treatment since they're already random.

---

## Verification

After implementation, manual test:

1. Log in as a seed user (e.g. marco@example.com)
2. Call `GET /api/friends/suggestions` — note the 10 returned IDs
3. Wait 10 min (cache expires) or delete `cache:friend-suggestions:{userId}` key from Redis
4. Call again — the 10 IDs should be a different set (unseen candidates surfaced)
5. Repeat until the pool exhausts — on reset, top-score users reappear

Redis inspection: `SMEMBERS suggestions:seen:{userId}` should grow with each batch.

---

## Risk / Rollback

- Errors in Redis calls are swallowed (non-fatal) — if Redis is unavailable, the function falls back to returning `scored.slice(0, limit)` (original deterministic behavior)
- No DB changes → no migration rollback needed
- To fully disable the feature: remove steps 3–5, restore `return scored.slice(0, limit)`
