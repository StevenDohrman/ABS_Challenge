# Phase 8C: API read batching (N+1 collapse)

**Agent task:** Replace parallel per-row **read** queries in hot API paths with **single multi-row queries**, reducing `dbGate` contention when the frontend polls during live games.

This phase is **read-only** optimization — no write batching. Complements [8A](./PHASE8A_SAVANT_DAILY_BULK_WRITES.md) / [8B](./PHASE8B_LINEUP_COUNT_PERF_BULK_WRITES.md).

Read [PHASE8_DB_WRITE_BATCHING_OVERVIEW.md](./PHASE8_DB_WRITE_BATCHING_OVERVIEW.md).

---

## Problem

Several controllers use `Promise.all` over N items — each item is a separate Prisma query, each acquiring a `dbGate` slot. During live play, schedule refresh (30 s) + game detail polls can overlap pipeline writes.

**Note:** Reads do not batch across Savant/MLB — this is internal DB query shape only.

---

## Targets (priority order)

### 1. Schedule — triggered recommendation flags (highest impact)

**File:** `backend/src/controllers/scheduleController.ts`

**Today:**

```ts
const triggeredFlags = await Promise.all(
  [...trackedSet].map(async (pk) => ({
    gamePk: pk,
    hasTriggered: await gameHasTriggeredRecommendation(pk),
  }))
);
```

**N queries** where N = tracked games (often 10–15).

**Target:** One query:

```sql
SELECT DISTINCT game_pk FROM challenge_recommendations
WHERE triggered_at IS NOT NULL AND game_pk IN (...)
```

Add `findGamePksWithTriggeredRecommendations(gamePks: number[]): Promise<Set<number>>` in `recommendationRepository.ts`.

### 2. Game export / recommendation history (medium)

**Files:**

- `backend/src/controllers/recommendationController.ts`
- `backend/src/services/gameExportService.ts`

**Today:** `Promise.all` of 3–4 independent reads (snapshots, recs, review pitches, audits).

**Target:** Keep parallel only where truly independent **and** total ≤ 3, OR add repository method `findGameDetailBundle(gamePk)` that uses a single raw query / `$transaction` with sequential reads (same 4 reads but **one orchestrated function**, easier to optimize later).

Lower priority than schedule — game detail is one `gamePk`, not N games.

### 3. Rankings controllers (lower)

**File:** `backend/src/controllers/rankingsController.ts`

`Promise.all([playerRows, teamRows, gameCount])` — fixed 3 queries, acceptable. Only optimize if profiling shows pain.

---

## Implementation checklist

### Schedule batch read

- [ ] `recommendationRepository.findGamePksWithTriggeredRecommendations`
- [ ] Replace `Promise.all` loop in `scheduleController`
- [ ] Test: 0, 1, many gamePks; empty `IN` list guard
- [ ] Frontend schedule behavior unchanged (`hasTriggeredRecommendation` on DTO)

### Optional bundle read helper

- [ ] `gameRepository.findGameReplayBundle(gamePk)` — returns snapshots + recs + pitches + audits in one module (implementation can still be 4 queries sequentially to use 1 slot at a time, **not** 4 parallel — that reduces peak from 4 to 1)

Document trade-off: sequential reads add latency ms per request but reduce peak connections — preferable for single-game detail.

### Tests

- [ ] `scheduleController` test or repository unit test for batched triggered lookup
- [ ] `npm run test --workspace=backend`

---

## Explicitly out of scope (8C)

- Write batching (Phases 8A/8B)
- Precompute reads inside `buildAtBatChallengeContext` — sequential today; optimizing joins is a separate perf pass and must not delay per-game live path
- Caching layer (Redis) — future phase if needed

---

## Success criteria

- [ ] Schedule endpoint: **1 query** for triggered flags regardless of tracked game count
- [ ] No regression in schedule DTO fields used by `frontend/src/hooks/useSchedule.ts`
