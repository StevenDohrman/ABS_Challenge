# Fielding missed RE → catcher attribution + split missed RE columns

**Agent task:** Attribute fielding-side **missed** run expectancy to the **catcher** (not the pitcher), resolving catcher identity from live defensive lineup data including mid-game substitutions. Split player-level missed RE into **batting** and **fielding** columns, mirroring how gained RE is already split.

Read this document before writing code. Run existing tests after each major step.

---

## Problem

When the defense fails to challenge a called **ball** that zone audit says was a strike, postgame audit flags a fielding-side miss. Today rankings credit that miss to the **pitcher** (`audit.pitcherId`). In practice, catchers are responsible for initiating fielding challenges.

There is an existing asymmetry:

| Event | Player credited today |
|-------|----------------------|
| Missed fielding challenge (no challenge made) | **Pitcher** ← wrong |
| Successful fielding overturn (challenge made) | **Challenger** (MLB `reviewDetails.player`, usually catcher) ← correct |

Teams already track `fieldingMissedValue` separately from `battingMissedValue`. **Players** only have a single `totalMissedValue` bucket that incorrectly mixes batting misses (batter) and fielding misses (pitcher).

---

## Desired behavior

1. **Fielding missed RE → catcher** at pitch time (within the at-bat).
2. **Batting missed RE → batter** (unchanged).
3. **Player rankings** expose split columns like gained RE:
   - `battingMissedRe` / `battingMissedCount` (or reuse `missedOpportunities` for batting only)
   - `fieldingMissedRe` / `fieldingMissedCount`
   - Keep `totalMissedValue` as sum for backward-compatible default sort, or derive it.
4. **Team rankings** already split batting/fielding missed — expose fielding missed in UI sort if not already (team `missedRe` sort currently uses `battingMissedValue` only).
5. **Do not** credit fielding misses to the pitcher.

---

## Data sources — where catcher ID lives

### ✅ Use this: `linescore.defense` on at-bat snapshots

`MlbAtBatSnapshot.defense` includes `catcher` (and all fielding slots). Parsed in:

- `data-pipeline/src/sources/mlb-live/mlbLive.parser.ts` → `parseDefensiveLineup()`
- Stored on `live_game_snapshots.rawPayload` (full snapshot JSON), **not** a dedicated DB column today.

Each at-bat snapshot is upserted when the at-bat index advances (`upsertAtBatSnapshot` in `backend/src/db/gameRepository.ts`). When the catcher is substituted between at-bats, the **next** snapshot reflects the new catcher. That is the correct granularity for missed-challenge attribution (per pitch, within an at-bat).

```ts
// data-pipeline/src/sources/mlb-live/mlbLive.types.ts
defense?: DefensiveLineup; // includes catcher?: number
```

### ❌ Do not use for catcher: `game_lineups`

`game_lineups` is **batting order only** (`playerId`, `battingOrder`). It does not store defensive positions or catcher.

### Fallback chain (document in code)

When resolving catcher for a fielding audit pitch:

1. **Primary:** `live_game_snapshots.rawPayload.defense.catcher` for `pitch.atBatIndex`
2. **Secondary:** Re-parse defense from stored snapshot if typed access is awkward — helper `getCatcherIdFromSnapshot(rawPayload)`
3. **Tertiary (backfill / thin feeds):** `linescore.defense.catcher` from pitch `rawPayload` play event if present
4. **Last resort:** `null` — attribute team-level `fieldingMissedValue` only; **do not** fall back to pitcher. Add audit note: `"Catcher ID unavailable — player attribution skipped"`.

Historical backfill at-bats may lack per-play defense (documented in `MlbAtBatSnapshot` comments). Team totals should still accrue; player attribution is best-effort.

---

## Key files to change

| Area | Path |
|------|------|
| Rankings delta (main logic) | `backend/src/services/rankingsDelta.ts` → `buildPostgameAuditDelta` |
| Postgame audit | `backend/src/services/postgameAuditService.ts` → pass catcher into audit context |
| Audit persistence | `backend/prisma/schema.prisma` → `PostgameChallengeAudit` |
| Audit DTO | `backend/src/dto/postgame.ts` |
| Rankings buckets | `backend/prisma/schema.prisma` → `PlayerRankingDayBucket`, `PlayerRankingSeasonTotal` |
| Bucket apply | `backend/src/db/rankingsBucketRepository.ts` |
| Rankings read | `backend/src/db/rankingsRepository.ts`, `backend/src/services/rankingsService.ts` |
| Rankings DTO | `backend/src/dto/rankings.ts`, `frontend/src/api/dto/rankings.ts` |
| Incremental apply | `backend/src/services/rankingsIncrementalService.ts` |
| Tests | `backend/src/__tests__/rankingsDelta.test.ts`, `postgameAuditService.test.ts`, `rankingsService.test.ts` |
| Frontend rankings UI | `frontend/src/screens/RankingsScreen.tsx`, `frontend/src/utils/rankingsSort.ts` |
| Docs | `frontend/src/screens/AboutPage.tsx`, `README.md` |

---

## Implementation checklist

### 1. Resolve catcher at audit time

**`postgameAuditService.ts`**

- Extend `AtBatSnapshotForAudit` (or audit input) with optional `catcherId: number | null`.
- When building `snapshotByAtBat`, extract catcher from `snap.rawPayload`:

  ```ts
  function catcherFromSnapshotPayload(raw: unknown): number | null {
    const defense = (raw as { defense?: { catcher?: number } })?.defense;
    return typeof defense?.catcher === "number" ? defense.catcher : null;
  }
  ```

- Pass `catcherId` into `PostgameAuditInput` for fielding audits (`buildFieldingAuditInput`).
- Persist `catcherId` on `PostgameChallengeAudit` row (new nullable column).

**Migration:** add `catcherId Int?` to `postgame_challenge_audits`.

### 2. Change rankings delta attribution

**`rankingsDelta.ts` → `buildPostgameAuditDelta`**

Replace pitcher attribution block:

```ts
// CURRENT (wrong)
addPlayerDelta(playerDeltas, audit.pitcherId, {
  missedOpportunities: 1,
  totalMissedValue: audit.runExpectancySwing,
});
```

With:

```ts
// DESIRED
if (audit.catcherId != null) {
  addPlayerDelta(playerDeltas, audit.catcherId, {
    fieldingMissedCount: 1,
    fieldingMissedValue: audit.runExpectancySwing,
  });
  playerAppearanceIds.push(audit.catcherId);
}
// Team fielding miss unchanged
addTeamDelta(teamDeltas, fieldingTeamId(...), {
  fieldingMissedCount: 1,
  fieldingMissedValue: audit.runExpectancySwing,
});
```

Batting-side misses should populate **batting** columns only:

```ts
addPlayerDelta(playerDeltas, audit.batterId, {
  battingMissedCount: 1,
  battingMissedValue: audit.runExpectancySwing,
});
```

Update `PostgameAuditContext` interface accordingly.

**Update test** `rankingsDelta.test.ts`:

- Rename `"attributes fielding missed opportunities to pitcher and fielding team"` → catcher + fielding team.
- Add test: catcher substitution between at-bats credits different catchers.
- Add test: null catcher → team fielding miss only, no player delta.

### 3. Split player missed RE in schema + buckets

**Prisma** — add to `PlayerRankingDayBucket` and `PlayerRankingSeasonTotal`:

```prisma
battingMissedCount   Int   @default(0)
battingMissedValue   Float @default(0)
fieldingMissedCount  Int   @default(0)
fieldingMissedValue  Float @default(0)
```

**Deprecation strategy for `totalMissedValue` / `missedOpportunities`:**

- Option A (recommended): Keep `totalMissedValue` as **computed sum** `battingMissedValue + fieldingMissedValue` on read; stop writing pitcher/batter into a combined bucket in delta apply.
- Option B: Keep writing `totalMissedValue` as sum in bucket apply for backward compat during migration.

**`PlayerBucketDelta`** — add `battingMissedCount`, `battingMissedValue`, `fieldingMissedCount`, `fieldingMissedValue`; migrate off overloading `totalMissedValue` for both sides.

**`rankingsBucketRepository.ts`** — increment new columns in day + season upserts; update `negateRankingsEventDelta`.

### 4. Rankings API + sort

**`PlayerRankingRowDto`** — add:

```ts
battingMissedValue: number;
fieldingMissedValue: number;
// totalMissedValue: batting + fielding (keep for default sort)
```

**`rankingsService.ts`:**

- `comparePlayerRows` missedRe sort: continue using `totalMissedValue` (= sum) unless product wants separate sort keys.
- Consider adding sort aliases: `battingMissedRe`, `fieldingMissedRe` (optional stretch).

**Team rows** — already have `battingMissedValue`; add `fieldingMissedValue` to DTO/UI if missing. Team `missedRe` sort currently uses batting only — decide whether to add fielding sort or a combined total (product call; default: expose both columns, keep batting as primary sort to avoid leaderboard churn).

### 5. Backfill / repair existing rankings

Existing `rankings_contributions` and bucket totals were built with pitcher attribution. After deploying:

1. Add a one-shot repair script or `repairFieldingMissedAttribution()` in `rankingsIncrementalService.ts`:
   - Re-process all `postgame_challenge_audits` where `challengeSide = 'fielding'` and `missedChallenge = true`
   - Negate old contribution (pitcher credited) + apply new contribution (catcher credited) idempotently via `rankings_contributions` unique `(sourceType, sourceId)`
2. Re-run `applyPostgameAuditContributionsForGame` for all tracked games, or full rebuild from contributions.

Document in PR: run repair after migration before trusting player missed-RE leaderboards.

### 6. Frontend

**`RankingsScreen.tsx`**

- Player table/cards: show **Bat missed RE** and **Fld missed RE** columns (mirror gained RE layout).
- Mobile cards: include both missed splits.
- Update footnote copy (currently implies player missed RE is batting-only).

**`AboutPage.tsx`** — fix inaccurate copy:

> "For players this is batting-side misses"

Should describe split batting/fielding missed RE and catcher attribution for fielding.

**`rankingsSort.ts`** — if new sort keys added, wire them; else sort by `totalMissedValue` unchanged.

### 7. Postgame audit DTO (optional UI polish)

Add `catcherId` to `PostgameAuditItemDto` for fielding-side misses so game detail can show who missed (future). Not required for rankings-only MVP.

---

## Tests to add/update

| Test | Assert |
|------|--------|
| `rankingsDelta` fielding miss | Catcher gets `fieldingMissedValue`; pitcher gets nothing |
| `rankingsDelta` batting miss | Batter gets `battingMissedValue` only |
| `rankingsDelta` null catcher | Team `fieldingMissedValue` increments; no player fielding miss |
| `postgameAuditService` | `buildFieldingAuditInput` includes catcher from snapshot payload |
| `rankingsService` | Player row `totalMissedValue` = batting + fielding |
| Integration | Two at-bats, different catchers in snapshots → misses split correctly |

---

## Edge cases

| Case | Handling |
|------|----------|
| Catcher defensive substitution mid-at-bat | Rare; use at-bat-start snapshot catcher. Note in docs. Pitch-time defense from linescore would be more accurate but is not stored per pitch today. |
| Pinch hitter only (no catcher change) | Unaffected |
| Backfill game without `defense` in snapshot | Team miss yes; player miss skip |
| Catcher = pitcher (Ohtani-style) | Still attribute to `catcherId` if present in defense slot |
| Repair idempotency | Use existing `rankings_contributions` dedup by `sourceType` + `sourceId` |

---

## Verification

```bash
npm run test --workspace=backend
npm run test --workspace=frontend
npm run build --workspace=backend
npm run build --workspace=frontend
```

Manual:

1. Find a final game with a fielding missed ball challenge in postgame audit.
2. Confirm rankings credit the **catcher** (not pitcher) under fielding missed RE.
3. Confirm batter still credited for batting-side strike misses.
4. Toggle light/dark + mobile rankings cards still readable.

---

## Explicitly out of scope

- Changing **gained RE** attribution (already uses challenger = catcher for fielding overturns).
- Storing full defensive lineup history per pitch (future enhancement).
- Engine recommendation logic.
- Using `game_lineups` for catcher (wrong table).
- Manager/coach challenge attribution (MLB attributes to catcher/batter in feed).

---

## Summary for the implementing agent

**One-sentence goal:** Stop giving fielding missed RE to pitchers; resolve catcher from `live_game_snapshots.rawPayload.defense.catcher` per at-bat, and split player missed RE into batting + fielding buckets like gained RE.

**Start here:** `backend/src/services/rankingsDelta.ts` line ~197, then schema migration, then repair script, then frontend columns.
