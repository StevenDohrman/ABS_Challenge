# Phase 7: SavantLineupJob — batter count-state RE scaling

**Agent task:** Wire `SavantLineupJob` so challenge run expectancy uses **batter-specific count performance** to scale the league `COUNT_DELTA` table in `runExpectancy.ts` — not credibility count modifiers.

Read this document before writing code. Run existing tests after each major step.

---

## Context — do not confuse with other features

| Feature | Status | Purpose |
|---------|--------|---------|
| **`lineupContext.ts`** | ✅ Wired | Due-up window; season OPS/wOBA → RE multiplier |
| **`playerCredibility.ts`** | ✅ Wired | P(call wrong) from discipline metrics — **unchanged in Phase 7** |
| **Phase 7 (this task)** | 🎯 Target | Per-batter wOBA-by-count → scale RE count deltas |

Daily pregame data (`SavantDailyJob`) feeds stat lines, spray, OAA, sprint, league averages, pitcher mix, and **league wOBA-by-count** from a season batter Statcast CSV. **Lineup-time** `SavantLineupJob` fetches per-batter pitch history for batter-specific wOBA-by-count.

Postgame audit uses MLB live feed pitch location — **do not wire `SavantPostgameJob`**.

---

## RE scaling formula

For each count state (`balls-strikes`):

```
delta = LEAGUE_COUNT_DELTA[count] × (batterWoba / leagueWoba)
```

When batter or league wOBA is unavailable for that count, fall back to fixed `LEAGUE_COUNT_DELTA` (same values as legacy `COUNT_DELTA`).

**Engine:** `engine/src/data/countDelta.ts` → `resolveCountDelta`  
**RE compute:** `computeChallengeOutcomeExpectancies(..., countDeltaContext?)` in `runExpectancy.ts`

---

## Data sources

| Data | Job | Storage |
|------|-----|---------|
| League wOBA-by-count | `SavantDailyJob` (season batter CSV) | `league_averages_snapshots.countWobaByState` |
| Batter wOBA-by-count | `SavantLineupJob` on lineup lock | `player_count_performance.buckets` (JSON) |

**Rollup:** `data-pipeline/src/sources/savant/countPerformance.ts`

- Terminal PAs grouped by count at PA end (`balls-strikes` on terminal pitch)
- `woba_value` / `woba_denom` from Savant CSV
- Optional `estimated_woba_using_speedangle` for thin samples (blend when PA ≥ 8, full trust at ≥ 20)

---

## Existing code to reuse

| Piece | Path |
|-------|------|
| Job | `data-pipeline/src/jobs/savantLineupJob.ts` |
| Fetch CSV | `savant.client.ts` → `fetchPlayerStatcastHistoryCsv`, `fetchSeasonBatterStatcastCsv` |
| Parse pitches | `savant.parser.ts` → `parsePlayerStatcastHistory` |
| Lineup hook | `orchestrator.ts` → `lineupUpdate` → `handleLineupUpdate` + `ingestCountPerformanceForGame` |
| Challenge inputs | `challengeInputBuilder.ts` → `CountDeltaContext` into RE compute |

---

## Implementation checklist

### 1. Prisma

- `player_count_performance` — `(playerId, season)` unique, `buckets` JSON, `fetchedAt`
- `league_averages_snapshots.countWobaByState` JSON

Migration: `20260712040000_player_count_performance`

### 2. Pipeline rollup

- `countPerformance.ts` — `rollupCountPerformance`, `effectiveCountWoba`, `toLeagueCountWoba`
- `leagueAverages.ts` — `computeLeagueCountWobaFromStatcastCsv` on daily job CSV
- `savantDailyJob.ts` — fetch season batter Statcast CSV (non-fatal on failure)

### 3. Backend ingest

- `countPerformanceRepository.ts` — upsert/find/recent refresh (6h skip)
- `countPerformanceIngestService.ts` — lineup batters via `SavantLineupJob`
- `orchestrator.ts` — enqueue ingest after lineup write (`low` priority)

### 4. Challenge wiring

- `countPerformanceContext.ts` — `buildBatterWobaByCount`
- `challengeInputBuilder.ts` — load DB buckets, pass `CountDeltaContext` to RE
- `leagueAveragesRepository.ts` / `leagueAveragesStore.ts` — persist/serve `countWobaByState`

### 5. Tests

- `countPerformance.test.ts`, `countDelta.test.ts`, `countPerformanceContext.test.ts`
- Mock `countPerformanceRepository` in `challengeService.test.ts`

---

## Operational notes

- **Refresh cadence:** Per-batter count performance skipped if refreshed within 6 hours
- **Fetch failure:** Use last DB data; RE falls back to fixed league deltas when buckets missing
- **Deploy:** Run `npx prisma migrate deploy` before starting backend with new code

---

## Explicitly out of scope

- Credibility count modifiers in `playerCredibility.ts`
- `SavantPostgameJob`
- Replacing RE24 base table or walk/K terminal paths
