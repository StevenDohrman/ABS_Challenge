# Phase 7: Wire SavantLineupJob (batter count-state splits)

**Agent task:** Implement end-to-end wiring of `SavantLineupJob` so the challenge engine uses **batter-specific count-state performance** instead of (or blended with) the fixed count modifier in `playerCredibility.ts`.

Read this entire document before writing code. Run existing tests after each major step.

---

## Context — do not confuse with lineup due-up

| Feature | Status | Purpose |
|---------|--------|---------|
| **`lineupContext.ts`** | ✅ Wired | Who is due up later this half-inning; season OPS/wOBA → RE multiplier |
| **`SavantLineupJob`** | ❌ Not wired | Per-batter pitch-by-pitch history → count buckets (0-0, 0-2, 3-2, …) |

Daily pregame data (`SavantDailyJob`) already feeds batter stat lines, spray, OAA, sprint, league averages, and pitcher pitch mix. **This task adds lineup-time pitch history for count splits only.**

Postgame audit uses MLB live feed pitch location — **do not wire `SavantPostgameJob`**.

---

## Existing code to reuse

| Piece | Path |
|-------|------|
| Job | `data-pipeline/src/jobs/savantLineupJob.ts` |
| Fetch CSV | `data-pipeline/src/sources/savant/savant.client.ts` → `fetchPlayerStatcastHistoryCsv` |
| Parse pitches | `data-pipeline/src/sources/savant/savant.parser.ts` → `parsePlayerStatcastHistory` |
| Type | `SavantPlayerPitchHistory` in `savant.types.ts` (balls, strikes, type B/S/X, etc.) |
| Lineup ingest hook | `backend/src/orchestrator.ts` → `LivePollJob` `lineupUpdate` → `handleLineupUpdate` |
| Lineup storage | `backend/src/db/lineupRepository.ts`, `GameLineup` Prisma model |
| Fixed count modifier (replace/blend) | `engine/src/features/playerCredibility.ts` → `computeCountModifier` |
| Engine entry | `backend/src/services/challengeInputBuilder.ts` → `ChallengeDecisionInput` |

Tests already exist: `data-pipeline/src/sources/savant/__tests__/savantLineupJob.test.ts`

---

## Implementation plan

### 1. Prisma — store count splits

Add a table (name suggestion: `player_count_splits`) keyed by `(playerId, season)` with JSON or normalized columns for each count bucket.

Suggested rollup fields per bucket (`"0-0"`, `"0-2"`, `"3-2"`, etc.):

- `pitchCount`
- `ballRate` / `strikeRate` (called pitches only, exclude in-play if appropriate)
- `chaseRate` proxy if derivable
- `whiffRate` if derivable
- Optional: wOBA proxy from events

Also add `fetchedAt` and optional `sourceGamePk` if splits are refreshed per game day.

**Migration:** create under `backend/prisma/migrations/` and update `schema.prisma`.

### 2. Rollup service — pitch history → splits

New module e.g. `data-pipeline/src/sources/savant/countSplits.ts` or `backend/src/services/countSplitsRollup.ts`:

- Input: `SavantPlayerPitchHistory[]`
- Group by count state at pitch (`balls-strikes` before pitch)
- Compute rates with minimum sample threshold (e.g. ≥ 20 pitches per bucket before trusting)
- Export typed `PlayerCountSplits` object

Unit tests with fixture CSV rows.

### 3. Orchestrator — run job on lineup confirmation

In `backend/src/orchestrator.ts`, extend the `lineupUpdate` handler (after `handleLineupUpdate` succeeds):

1. Collect unique batter IDs from both teams’ batting orders (`GameLineup` rows).
2. Optionally include pitchers as `playerType: "pitcher"` only if needed later — **batters only for v1**.
3. Instantiate `SavantLineupJob`, subscribe to `playerHistory`, persist rollups via new repository.
4. Dedupe: skip if splits for `(playerId, season)` were fetched in the last N hours unless lineup changed materially.
5. Run in background (do not block live poll); log errors per player.

Reference pattern: `runSavantDailyJob()` in the same file.

### 4. Repository + ingest handler

- `backend/src/db/countSplitsRepository.ts` — upsert/find by player + season
- `backend/src/services/ingestService.ts` — `handlePlayerCountSplits` or inline in lineup handler

### 5. Engine — new input fields

Extend `PlayerChallengeContext` in `engine/src/domain/playerContext.types.ts`:

```ts
countSplits?: {
  bucket: string;        // current count e.g. "0-2"
  ballRate: number | null;
  strikeRate: number | null;
  sampleSize: number;
} | null;
```

Populate in `challengeInputBuilder.ts` from DB for current batter + current count.

### 6. Engine — blend into credibility

In `playerCredibility.ts`:

- When `countSplits` has sufficient sample, compute a **batter-specific** count adjustment (e.g. high chase / low discipline at 0-2 → higher P(call wrong)).
- When missing or low sample, **fall back** to existing `computeCountModifier` (fixed table).
- Keep adjustment magnitude similar to current ±0.06 range unless tests justify wider bounds.

Add engine tests in `engine/src/__tests__/playerCredibility.test.ts` (or new file).

### 7. Backend integration tests

- Mock `SavantLineupJob` emit → verify DB upsert
- `challengeInputBuilder` includes count splits when present
- End-to-end: lineup update triggers job (can mock Savant HTTP)

### 8. Docs + UI (optional)

- Update README Phase 7 section to “done” when complete
- About / How it works: one line on batter-specific count context (optional)

---

## Constraints

- **Rate limits:** `SavantLineupJob` batches requests (default 3 players, 500ms delay). Do not remove.
- **Fallback:** Never fail live recommendations when Savant lineup fetch fails.
- **No SavantPostgameJob:** Postgame path is MLB live feed only.
- **Minimize scope:** Do not refactor RE24 tables or ML in this task.

---

## Verification checklist

```bash
npm run test --workspace=data-pipeline
npm run test --workspace=engine
npm run test --workspace=backend
npm run frontend:test
npm run pipeline:build
npm run build --workspace=backend
```

Manual: trigger lineup update on a tracked game; confirm splits rows in DB; confirm live recommendation still returns; inspect explanation/credibility breakdown if exposed.

---

## Suggested commit message

```
Wire SavantLineupJob for batter count-state splits and blend into player credibility.
```
