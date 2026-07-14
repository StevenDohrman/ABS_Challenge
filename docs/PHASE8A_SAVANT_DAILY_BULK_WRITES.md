# Phase 8A: Savant daily bulk writes + ingest serialization

**Agent task:** Replace per-row concurrent upserts for `SavantDailyJob` ingest with **bulk writes**, and **serialize** daily ingest handlers so at most one Savant table flush runs at a time (or one flush + league averages).

Read [PHASE8_DB_WRITE_BATCHING_OVERVIEW.md](./PHASE8_DB_WRITE_BATCHING_OVERVIEW.md) first.

---

## Problem

After CSV download, `SavantDailyJob.run()` parses six datasets and emits six events. Orchestrator handlers (`handleBatterStatlines`, `handleSprayProfiles`, etc.) run **concurrently**, each calling `mapSettledWithConcurrency(..., WRITE_CONCURRENCY=4)`.

**Observed fan-out:** up to ~24 concurrent upsert attempts → all compete for `dbGate`’s 10 slots → queueing and historical P2024 risk.

**Savant HTTP:** Already batched (one CSV per leaderboard). This phase is **DB only**.

---

## Tables in scope

| Pipeline event | Repository | Unique key | Approx row count |
|----------------|------------|------------|------------------|
| `batterStatlines` | `playerRepository` | `(playerId, season)` | ~300 qualified batters |
| `sprayProfiles` | `defensiveRepository` | `(playerId, season)` | ~200+ |
| `fielderOaa` | `defensiveRepository` | `(playerId, season, position)` | ~300+ |
| `sprintSpeed` | `sprintSpeedRepository` | `(playerId, season)` | ~200+ |
| `pitcherPitchMix` | `pitcherPitchMixRepository` | `(pitcherId, season, pitchType)` | ~1000+ rows |
| `leagueAverages` | `leagueAveragesRepository` | single snapshot row | 1 |

`leagueAverages` is already one upsert — keep as-is; just run it in the serialized ingest sequence.

---

## Implementation checklist

### 1. Shared bulk upsert helper

Create `backend/src/db/bulkUpsert.ts`:

- `bulkUpsertPlayerStatSnapshots(rows: PlayerStatSnapshotInput[]): Promise<BulkUpsertResult>`
- Generic result type: `{ inserted: number; updated: number; failed: number }` or row-level error log
- Use **Postgres `INSERT … ON CONFLICT … DO UPDATE`** via `prisma.$executeRaw` for large batches
- **Single `dbGate` slot** for the whole statement (one Prisma raw query = one gate acquisition)
- Chunk if payload exceeds safe parameter size (e.g. 500 rows per statement)

Reference unique constraints in `backend/prisma/schema.prisma`:

- `PlayerStatSnapshot`: `@@unique([playerId, season])`
- `PlayerSprayProfile`: `@@unique([playerId, season])`
- `FielderOaa`: `@@unique([playerId, season, position])`
- `PlayerSprintSpeed`: `@@unique([playerId, season])`
- `PitcherPitchMix`: `@@unique([pitcherId, season, pitchType])`

**Player names:** `upsertBatterStatline` currently calls `recordPlayerName`. Options:

- (A) Second bulk pass for `player_names` with `ON CONFLICT`
- (B) Include name upsert in same transaction after stat snapshot bulk
- Document choice in PR; do not drop name recording

### 2. Replace repository batch functions

Refactor (keep old names as public API; change implementation):

| Function | New behavior |
|----------|--------------|
| `upsertBatterStatlines(statlines)` | Map to row DTOs → `bulkUpsertPlayerStatSnapshots` |
| `upsertSprayProfiles(profiles)` | Bulk upsert spray table |
| `upsertFielderOaa(rows)` | Bulk upsert OAA table |
| `upsertSprintSpeed(rows)` | Bulk upsert sprint table |
| `upsertPitcherPitchMixBatch(rows)` | Bulk upsert pitch mix (largest table — chunking important) |

Keep **single-row** `upsertBatterStatline` etc. for tests and edge cases if still referenced.

### 3. Serialize Savant daily ingest in orchestrator

**Option A (recommended):** Inline sequential awaits inside `runSavantDailyJob` after `job.run()` — collect parsed payloads on the job and call ingest handlers one after another instead of fire-and-forget event handlers.

**Option B:** Route each handler through `enqueuePipelineDbWork(..., "low")` with a single shared tail so only one runs at a time.

Do **not** parallelize the six ingests anymore.

Suggested order (largest / most downstream first):

1. `batterStatlines` — challenge inputs depend on player stats
2. `sprayProfiles` + `fielderOaa` + `sprintSpeed` — defensive context
3. `pitcherPitchMix`
4. `leagueAverages` — may reference daily CSV aggregates

### 4. Optional: coalesce inside `SavantDailyJob`

Instead of six emits + six handlers, add `SavantDailyJob.run()` return value or single `dailyIngestReady` event with all parsed arrays. Reduces event wiring complexity. Only if orchestrator refactor is already large.

### 5. Tests

- [ ] Unit test bulk helper with 2–3 rows against test DB (or mocked `$executeRaw`)
- [ ] Update `playerRepository` / `defensiveRepository` tests if they assert per-row call counts
- [ ] Integration: mock Savant CSVs → run daily job → verify row counts without `mapSettledWithConcurrency` spy firing 300 times
- [ ] Regression: `npm run test --workspace=backend`

### 6. Verification

- [ ] Log wall-clock for each bulk table + total Savant ingest
- [ ] Compare `getDbGateStats().maxInFlight` during ingest before/after (target ≤ 4 during daily flush)

---

## Explicitly out of scope (8A)

- At-bat recommendation precompute (`challenge_recommendations`)
- Live poll ingest
- Savant HTTP / CSV download changes (see separate Savant timeout work in `savant.constants.ts`)
- `countPerformanceIngest` — Phase 8B

---

## Rollback

Bulk helpers should sit behind existing `upsert*BatterStatlines` function signatures so reverting to `mapSettledWithConcurrency` is a one-file rollback per repository.
