# Dynamic Friend Suggestions — Design Spec

**Date:** 2026-05-25  
**Branch:** PF-104  
**Status:** Approved

## Problem

`getSmartFriendSuggestions` is fully deterministic — the same users always score highest and always appear in the top 10. The list never rotates unless friend relationships change, so users see the same faces indefinitely.

## Goal

Rotate suggestions so that already-shown users are deprioritized and new candidates surface over time, while preserving the quality-first scoring logic.

## Solution

A Redis Set per user tracks which candidates have already been shown. On each new batch computation, unseen candidates are preferred. When the unseen pool is exhausted, the set resets and the cycle starts over.

## Data Model

```
KEY:  suggestions:seen:{userId}
TYPE: Redis Set
VALUE: Set of userId strings already shown as suggestions to this user
TTL:  30 days (auto-reset if user is inactive)
```

No new DB models or migrations required.

## Service Logic — `getSmartFriendSuggestions`

Changes are confined to `backend/src/services/similarity.service.ts`.

Existing steps (unchanged):
1. Load current user + profile
2. Exclude existing friends / pending requests
3. Retrieve candidates via vector similarity or SQL fallback
4. Score all candidates (profile similarity, university, course, mutual friends, shared saves)

New steps inserted after scoring:

```
5. Load seen set: SMEMBERS suggestions:seen:{userId}
6. Split candidates:
     unseen = scored candidates whose id is NOT in seen set
     seen   = scored candidates whose id IS in seen set
7. Build result:
     if unseen.length >= limit:
       result = top N from unseen (sorted by score desc)
     else:                          // pool exhausted → reset cycle
       DEL suggestions:seen:{userId}
       result = top N from ALL candidates (sorted by score desc)
8. SADD suggestions:seen:{userId} ← IDs of result
9. EXPIRE suggestions:seen:{userId} 2592000  (30 days)
10. Return result
```

## Cache Interaction

The route layer caches the computed result for 10 minutes (`cache:friend-suggestions:{userId}`). The seen set is updated **only when a fresh batch is computed** (cache miss). On a cache hit, the route returns early before calling the service — the seen set is not touched. This is correct: a cache hit means the user is seeing the same session, not a new one.

The existing cache invalidation on friend request send/accept (`cacheDel`) remains unchanged.

## Reset Semantics

The cycle resets when `unseen.length < limit` at computation time. At that point:
- The seen set is deleted
- The full candidate pool is used, sorted by score (same as original behavior)
- The next batch repopulates the seen set from scratch

If a user never exhausts the pool (many candidates), the seen set grows gradually and old entries are cleared by the 30-day TTL.

## Scope

- **Modified:** `backend/src/services/similarity.service.ts` — `getSmartFriendSuggestions` function only
- **No changes to:** routes, frontend, DB schema, cache keys, scoring algorithm

## Out of Scope

- Tracking impressions across `/profile/suggestions` separately (both endpoints call the same service; they share the same seen set, which is fine)
- Analytics on ignored suggestions
- Per-user configurable rotation frequency
