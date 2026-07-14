# Phase 8: DB write batching — overview

**Goal:** Reduce concurrent DB connection pressure by **collecting rows in memory, then writing in bulk** (or in a few chunked transactions) instead of fanning out hundreds of per-row `upsert` calls with `WRITE_CONCURRENCY = 4`.

**Motivation:** Today the largest spikes come from Savant daily ingest (six parallel handlers × four concurrent upserts each, competing for `dbGate`’s 10 slots). Live at-bat **precompute** is intentionally **not** in scope — one game’s frontend must not wait on another game’s writes, and MLB does not support multi-game live feeds anyway.

Read sub-phase docs before implementing. Run existing tests after each phase.

---

## Phase map

| Phase | Doc | Scope | Priority |
|-------|-----|--------|----------|
| **8A** | [PHASE8A_SAVANT_DAILY_BULK_WRITES.md](./PHASE8A_SAVANT_DAILY_BULK_WRITES.md) | Savant daily bulk tables + serialize daily ingest | **High** — biggest connection spike |
| **8B** | [PHASE8B_LINEUP_COUNT_PERF_BULK_WRITES.md](./PHASE8B_LINEUP_COUNT_PERF_BULK_WRITES.md) | Lineup upserts + count-performance ingest | Medium |
| **8C** | [PHASE8C_API_READ_BATCHING.md](./PHASE8C_API_READ_BATCHING.md) | Collapse N+1 API reads (schedule triggered flags, etc.) | Medium — read slots, not writes |

Suggested order: **8A → 8B → 8C**. Each phase is independently deployable.

---

## What stays unchanged (explicitly out of scope)

| Area | Why |
|------|-----|
| **At-bat precompute** (`precomputeAtBatRecommendations`, 12-count grid) | Per-game hot path; must stay responsive; already serialized via `pipelineDbQueue` high priority |
| **Live pitch / at-bat ingest** (`upsertPitchEvent`, `upsertAtBatSnapshot`) | Single-row, event-driven; batching would add latency |
| **MLB / Savant HTTP** | No multi-game or multi-player query API; batching is a **DB-layer** optimization only |
| **Cross-game precompute ordering** | Do not block game A’s recommendations on game B’s DB work |

---

## Current architecture (baseline)

### Connection limits

- **`dbGate`:** `MAX_CONCURRENT_QUERIES = 10` — every Prisma op acquires a slot (`backend/src/db/dbGate.ts`)
- **`WRITE_CONCURRENCY`:** `4` — fan-out inside bulk helpers (`mapSettledWithConcurrency`)

### Bulk ingest today (row-by-row)

| Repository | Trigger | Pattern |
|------------|---------|---------|
| `playerRepository.upsertBatterStatlines` | SavantDailyJob | N × `upsert`, concurrency 4 |
| `defensiveRepository.upsertSprayProfiles` | SavantDailyJob | N × `upsert`, concurrency 4 |
| `defensiveRepository.upsertFielderOaa` | SavantDailyJob | N × `upsert`, concurrency 4 |
| `sprintSpeedRepository.upsertSprintSpeed` | SavantDailyJob | N × `upsert`, concurrency 4 |
| `pitcherPitchMixRepository.upsertPitcherPitchMixBatch` | SavantDailyJob | N × `upsert`, concurrency 4 |
| `lineupRepository.upsertGameLineup` | Live lineupUpdate | N × `upsert`, concurrency 4 |
| `countPerformanceIngestService` | Lineup lock | `Promise.allSettled` per batter — **uncapped** |

### Savant daily orchestration gap

`SavantDailyJob` emits six events; orchestrator handlers run **in parallel** and **do not** use `enqueuePipelineDbWork` (`backend/src/orchestrator.ts`). Phase 8A should fix both **write shape** and **handler serialization**.

---

## Target pattern (all write phases)

```
Parse CSV / receive rows in memory
        ↓
Normalize to DB row DTOs (already typed from pipeline)
        ↓
bulkUpsertX(rows) — one or few DB round trips
        ↓
Optional: recordPlayerNames in same transaction or second bulk pass
```

### Prisma / Postgres options (pick per table in 8A)

| Approach | Pros | Cons |
|----------|------|------|
| **Raw SQL** `INSERT … ON CONFLICT DO UPDATE` with `unnest()` | True single round trip; fastest | More code; must match schema columns |
| **Chunked `$transaction`** (e.g. 50 upserts per tx, sequential chunks) | Stays in Prisma; easy to test | Still multiple round trips; fewer concurrent slots |
| **`createMany` + `skipDuplicates`** | Simple | **Does not update** existing rows — wrong for daily refresh |

**Recommendation:** Shared helper `backend/src/db/bulkUpsert.ts` with raw SQL for large Savant tables; chunked transaction fallback where row count is small (lineup ~26 rows).

---

## Success metrics

- [ ] Savant daily startup: `dbGate` `maxInFlight` stays ≤ 6 during ingest (measure via `/health` pool stats if exposed)
- [ ] No P2024 pool timeouts during daily job + live poll overlap
- [ ] Savant daily ingest wall time ≤ prior implementation (bulk should be faster)
- [ ] All existing repository / ingest tests green; add bulk-specific tests per phase

---

## Files likely touched (cross-phase)

| Area | Paths |
|------|-------|
| Bulk helper | `backend/src/db/bulkUpsert.ts` (new) |
| Repositories | `playerRepository`, `defensiveRepository`, `sprintSpeedRepository`, `pitcherPitchMixRepository`, `lineupRepository`, `countPerformanceRepository` |
| Ingest | `ingestService.ts`, `countPerformanceIngestService.ts` |
| Orchestrator | `orchestrator.ts` — Savant daily handler queue |
| API | `scheduleController.ts`, optionally `recommendationController.ts` |
| Tests | `backend/src/__tests__/` per repository |

---

## Related docs

- [PHASE7_SAVANT_LINEUP_JOB.md](./PHASE7_SAVANT_LINEUP_JOB.md) — count-performance ingest (8B extends)
- [FIELDING_MISSED_RE_CATCHER_ATTRIBUTION.md](./FIELDING_MISSED_RE_CATCHER_ATTRIBUTION.md) — independent; do not mix into Phase 8
