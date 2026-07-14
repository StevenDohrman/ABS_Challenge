# Phase 8B: Lineup + count-performance bulk writes

**Agent task:** Batch DB writes for **live lineup updates** and **lineup-time count-performance ingest**, without changing at-bat precompute behavior.

Depends on [Phase 8A](./PHASE8A_SAVANT_DAILY_BULK_WRITES.md) bulk helper patterns (reuse `bulkUpsert.ts` where applicable).

Read [PHASE8_DB_WRITE_BATCHING_OVERVIEW.md](./PHASE8_DB_WRITE_BATCHING_OVERVIEW.md) for out-of-scope rules.

---

## Problem

### Lineup (`lineupUpdate`)

`upsertGameLineup` runs `mapSettledWithConcurrency` over ~18–26 entries (both teams). Low volume but unnecessary fan-out when a single bulk statement suffices.

### Count performance (`ingestCountPerformanceForGame`)

On lineup lock, orchestrator enqueues Savant fetches then persists per batter:

```ts
// countPerformanceIngestService.ts — uncapped
await Promise.allSettled(persistPromises);
```

Each `playerHistory` event appends an async upsert. Under slow DB, promises can pile up beyond `WRITE_CONCURRENCY`.

**HTTP:** `SavantLineupJob` still fetches **one player per request** (Savant limitation). Phase 8B only batches the **DB persist** after history is collected.

---

## Design principles

1. **Per-game isolation** — all work keyed by `gamePk`; never batch across games in one transaction.
2. **Collect then write** — finish Savant fetches (or a batch of them), aggregate rollup results in memory, then one bulk upsert per game.
3. **Do not block live precompute** — count-performance stays on `pipelineDbQueue` **low** priority (already true in `orchestrator.ts`).

---

## Implementation checklist

### 1. Bulk lineup upsert

**Table:** `game_lineups` — `@@unique([gamePk, teamId, playerId])`

Refactor `upsertGameLineup(entries)`:

- Map `GameLineupEntry[]` → row DTOs
- Single `bulkUpsertGameLineups` (raw SQL or one `$transaction` with ~26 upserts — small enough for either)
- Remove `mapSettledWithConcurrency` from `lineupRepository.ts`

**Call site:** `ingestService.handleLineupUpdate` — unchanged signature.

### 2. Refactor count-performance ingest

**Current flow:**

```
lineupUpdate → handleLineupUpdate → enqueue ingestCountPerformanceForGame (low)
  → SavantLineupJob.run(players)
  → on each playerHistory: fire async upsertPlayerCountPerformance
  → Promise.allSettled(persistPromises)
```

**Target flow:**

```
lineupUpdate → handleLineupUpdate → enqueue ingestCountPerformanceForGame (low)
  → SavantLineupJob.run(players)
  → collect { playerId, buckets }[] in memory (no DB in event handler)
  → bulkUpsertPlayerCountPerformance(rows) — one or chunked statements
```

**Table:** `player_count_performance` — `@@unique([playerId, season])`, `buckets` JSON.

Changes:

- [ ] `countPerformanceIngestService.ts` — accumulate results in array; bulk write after `job.run()` completes
- [ ] `countPerformanceRepository.ts` — add `bulkUpsertPlayerCountPerformance`
- [ ] Keep 6-hour refresh skip (`findRecentlyRefreshedPerformancePlayerIds`) — filter **before** Savant fetch, unchanged

### 3. SavantLineupJob event API (optional cleanup)

If collectors move to service layer, `playerHistory` events can remain for logging/tests but should not trigger DB writes directly. Alternatively add `job.run()` return type `PlayerHistoryResult[]` to avoid mutable accumulators in listeners.

### 4. Tests

- [ ] `lineupRepository` / ingest tests — full lineup round-trip with one bulk call
- [ ] `countPerformanceIngestService` — mock `SavantLineupJob`, assert single bulk upsert with N players
- [ ] Existing `countPerformanceContext.test.ts` unchanged

---

## Explicitly out of scope (8B)

- Batching Savant HTTP requests (still 3 players per batch in `SavantLineupJob`)
- Precompute / `challenge_recommendations`
- Cross-game bulk upsert

---

## Success criteria

- [ ] `ingestCountPerformanceForGame` never runs more than **1–2** concurrent DB statements for the persist phase
- [ ] Lineup update: ≤ 2 DB round trips (lineup bulk + optional name records)
