# Strike Zone Challenge Recommendation System

## Project Overview

This project is a baseball challenge recommendation system designed to help teams or fans decide whether a player should be allowed or encouraged to challenge a called ball or strike. The system is not primarily focused on determining whether a pitch was correct in real time. Instead, it focuses on whether using a challenge is strategically worthwhile given the current game state, player confidence, remaining challenge opportunities, and expected value of the situation.

The core idea is:

> A challenge should only be used when the expected value of correcting the call is worth the cost of spending the challenge.

For example, a questionable call in a low-leverage early-game situation may not be worth challenging, while a 50/50 call in a late-game, high-run-expectancy situation may be worth allowing if the player is reasonably confident.

---

## Project Goals

The system should answer questions such as:

- Should the player be allowed to challenge questionable pitches this at bat?
- How confident should the player be before challenging?
- Is this situation valuable enough to justify using a challenge?
- Are we being too conservative or too aggressive with challenges?
- Which missed challenges had the highest expected value?

---

## Data Source Strategy

The project separates live game decision-making from postgame analysis.

### Live Data

Live recommendations should be based on the MLB live game feed and preloaded contextual data.

Live inputs include:

- Inning
- Outs
- Count
- Runners on base
- Score
- Run differential
- Batter
- Pitcher
- Batting team
- Fielding team
- Current call
- Game status
- Remaining challenge count

The live engine does not depend on Baseball Savant pitch-location data because Savant is not a real-time source. Postgame zone audit also uses MLB live feed pitch location stored at ingest time — not Savant CSVs.

### Pregame / Daily Data

Pregame or daily data should be ingested before games and reused throughout the game.

Examples:

- Hitter AVG
- Hitter OBP
- Hitter OPS
- Walk rate
- Strikeout rate
- Batter handedness
- Pitcher handedness
- Hitter splits vs left-handed pitchers
- Hitter splits vs right-handed pitchers
- Historical player challenge success rate
- Batter spray profile (pull%, straightaway%, oppo%, GB/FB/LD mix)
- Fielder Outs Above Average (OAA) by position and by batter handedness
- Sprint speed (base-running context)
- Daily league-average baselines (chase, walk, K, whiff, OPS, wOBA, batted-ball mix)
- Pitcher season pitch mix (challenge hints — display only)

Defensive, spray, sprint, league-average, and pitcher pitch-mix data are fetched daily by `SavantDailyJob`, stored in the database, and wired into live engine decisions. Pregame computations are keyed to players in the confirmed lineup — no additional Savant API calls at decision time.

### Postgame Data

Postgame audit uses **pitch location already ingested from the MLB live feed** (`live_pitch_events.plateX`, `plateZ`, `mlbZone`, strike-zone height). It does not wait on Baseball Savant CSV enrichment.

Postgame analysis answers:

- Which batting calls (called strikes) and fielding calls (called balls) were zone-wrong?
- Which wrong calls had positive run-expectancy value if overturned but were not challenged successfully?
- Which challenges were used despite low-value live recommendations?
- How do missed and gained run expectancy aggregate across players and teams?

Zone labels come from MLB zone metadata and plate coordinates stored at live ingest time.

---

## High-Level Architecture

```txt
MLB Live API
  -> live game state ingestion
  -> pitch event ingestion
  -> current game context

Pregame / Daily Data
  -> player stats
  -> handedness splits
  -> defensive metrics
  -> run expectancy tables

Challenge Engine
  -> expected value calculation
  -> challenge recommendation
  -> confidence threshold
  -> explanation

Backend API
  -> exposes recommendations
  -> stores live snapshots
  -> serves frontend data

Frontend
  -> displays recommendation
  -> collects player confidence
  -> shows explanation

Baseball Savant Postgame Pipeline
  -> enriches pitch data
  -> audits missed challenges
  -> evaluates model performance
```

---

## Recommended Repository Structure

```txt
project-root/
  backend/
    src/
      controllers/
      dto/
      routes/
      services/

  frontend/
    src/
      components/
      pages/
      services/
      types/

  engine/
    src/
      domain/
      decision/
      features/
      utils/

  data-pipeline/
    src/
      sources/
        mlb-live/
        savant/
      ingestors/
      mappers/
      jobs/
```

> **Note:** There is no separate `shared` workspace — common types live in `@abs/engine` and `@abs/data-pipeline` package exports.

---

## Package Responsibilities

### Cross-package types

Stable baseball primitives (player IDs, game state, etc.) are defined in `@abs/engine` domain types and `@abs/data-pipeline` source types. Import through each package’s public `index.ts` rather than a shared workspace.

Use engine/domain types for challenge decisions; use data-pipeline types for ingest and MLB/Savant parsing.

**Previously planned `shared/` package** — removed as unused; add a workspace only when two or more packages need the same schema.

---

### `data-pipeline`

The `data-pipeline` package owns data ingestion.

It should be responsible for:

- Polling the MLB live game feed
- Parsing live game state
- Parsing pitch events
- Ingesting pregame or daily player data
- Running postgame Savant enrichment
- Mapping raw API data into clean internal objects
- Writing raw and normalized data to storage

Source-specific types should live inside the source folder.

Example:

```txt
data-pipeline/src/sources/mlb-live/
  mlbLive.client.ts
  mlbLive.parser.ts
  mlbLive.types.ts

data-pipeline/src/sources/savant/
  savant.client.ts
  savant.parser.ts
  savant.types.ts
```

The data pipeline should preserve raw payloads when possible. Raw data is useful for debugging, reprocessing, and correcting parser mistakes later.

---

### `engine`

The `engine` package owns decision-making logic.

It should not know or care where the data came from. The engine should only receive clean domain objects.

The engine should be responsible for:

- Building challenge feature vectors
- Calculating run expectancy impact
- Estimating challenge value
- Applying challenge rules
- Producing a recommendation
- Producing a confidence threshold
- Producing human-readable explanations

Example engine input:

```ts
export interface ChallengeDecisionInput {
  gameState: GameStateContext;
  playerContext: PlayerChallengeContext;
  pitchContext: PitchCallContext;

  currentRunExpectancy: number;
  runExpectancyIfChallengeSucceeds: number;
  runExpectancyIfChallengeFails: number;
}
```

Example engine output:

```ts
export interface ChallengeDecision {
  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  minimumPlayerConfidenceRequired: number;
  expectedValueOfChallenge: number;
  score: number;
  explanation: string[];
}
```

The engine should not import from `backend`, `frontend`, or source-specific ingestion code.

---

### `backend`

The `backend` package exposes the system to the frontend and coordinates application behavior.

It should be responsible for:

- API routes
- Authentication, if needed
- Reading live game data from storage
- Calling the challenge engine
- Saving recommendations
- Serving frontend-ready DTOs

Backend DTOs should be different from raw engine types when necessary. The backend should convert engine outputs into frontend-friendly responses.

Example:

```ts
export interface ChallengeRecommendationResponseDto {
  gamePk: number;
  pitchId: string;

  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  minimumConfidenceRequired: number;
  expectedValue: number;

  displayMessage: string;
  reasons: string[];

  inning: number;
  count: string;
  outs: number;
  baseState: string;
}
```

---

### `frontend`

The `frontend` package owns display logic and user interaction.

It should be responsible for:

- Showing the current game state
- Showing the challenge recommendation
- Displaying explanation text
- Showing challenge history
- Showing postgame review results

The frontend should not know about raw MLB API or Baseball Savant data structures.

Frontend types should be view models, not ingestion models.

Example:

```ts
export interface ChallengeCardViewModel {
  title: string;
  recommendationLabel: string;
  recommendationTone: "green" | "yellow" | "red";
  confidenceText: string;
  reasons: string[];
  gameSituationText: string;
}
```

---

## Dependency Direction

Dependencies should flow in one direction.

Recommended dependency flow:

```txt
engine
  -> backend

data-pipeline
  -> backend

backend
  -> frontend through API responses
```

Avoid these dependencies:

```txt
engine -> backend
engine -> frontend
engine -> data-pipeline

frontend -> data-pipeline
frontend -> engine internals

data-pipeline -> frontend
```

The best mental model is:

```txt
data-pipeline = how data enters the system
engine = how decisions are made
backend = how decisions are served
frontend = how decisions are displayed
```

---

## Core Data Flow

### During the Game

```txt
1. Poll MLB live game feed.
2. Parse current game state.
3. Parse pitch events.
4. Store raw live payload.
5. Store normalized game snapshot.
6. Store normalized pitch event.
7. Combine live state with pregame player context.
8. Send clean input to challenge engine.
10. Store recommendation output.
11. Serve recommendation to frontend.
```

### After the Game

```txt
1. Pull Baseball Savant data roughly 1 hour after game completion.
2. Join Savant pitch rows with stored live pitch events.
3. Determine whether calls were likely missed.
4. Compare actual recommendation against postgame truth.
5. Mark missed challenges and bad allowed challenges.
6. Store audit results.
7. Use audit results to improve thresholds.
```

---

## Live Polling Strategy

The MLB live game feed should be polled during active games.

Suggested polling intervals:

```txt
Pregame:
  every 5 minutes

Live game, active play:
  every 30 seconds

Between innings, delays, pitching changes:
  every 60 seconds

Final:
  stop live polling after final snapshot is stored
```

Baseball Savant should not be polled as part of the live recommendation loop.

Suggested Savant timing:

```txt
During game:
  never, not possible since savant does not provide live feeds

After final:
  poll every 5-10 minutes after 30mins from game conclusion until data is available

Next morning:
  run one cleanup backfill
```

---

## Important Interfaces

### Live Challenge Context

```ts
export interface LiveChallengeContextIngest {
  gamePk: number;
  playId?: string;
  atBatIndex: number;
  pitchNumber: number;

  inning: number;
  halfInning: "top" | "bottom";
  inningsLeftEstimate: number;

  outs: number;
  balls: number;
  strikes: number;

  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;

  homeScore: number;
  awayScore: number;
  runDifferentialForBattingTeam: number;

  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  fieldingTeamId: number;

  callDescription?: string;
  callCode?: string;

  fetchedAt: string;
}
```

### Pregame Player Context

```ts
export interface PregamePlayerContextIngest {
  playerId: number;
  season: number;

  battingHand: "L" | "R" | "S" | null;

  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;

  walkRate: number | null;
  strikeoutRate: number | null;

  opsVsLeft: number | null;
  opsVsRight: number | null;

  walkRateVsLeft: number | null;
  walkRateVsRight: number | null;

  historicalChallengeAttempts: number;
  historicalChallengeSuccessRate: number | null;

  fetchedAt: string;
}
```

### Challenge Decision Input

```ts
export interface ChallengeDecisionInput {
  gameState: GameStateContext;
  playerContext: PlayerChallengeContext;
  pitchContext: PitchCallContext;

  currentRunExpectancy: number;
  runExpectancyIfChallengeSucceeds: number;
  runExpectancyIfChallengeFails: number;
}
```

### Challenge Decision Output

```ts
export interface ChallengeDecision {
  recommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";

  minimumPlayerConfidenceRequired: number;
  expectedValueOfChallenge: number;
  score: number;

  explanation: string[];
}
```

### Postgame Challenge Audit

```ts
export interface PostgameChallengeAudit {
  gamePk: number;
  atBatNumber: number;
  pitchNumber: number;

  batterId: number;
  pitcherId: number;

  inning: number;
  balls: number;
  strikes: number;
  outs: number;

  originalCall: "ball" | "strike" | "unknown";

  plateX: number | null;
  plateZ: number | null;
  szTop: number | null;
  szBot: number | null;

  zoneResult: "ball" | "strike" | "unknown";
  callWasProbablyWrong: boolean;

  liveRecommendation?: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY";
  playerConfidence?: number;

  shouldHaveChallenged: boolean;
  missedChallenge: boolean;
  badChallengeAllowed: boolean;

  runExpectancySwing: number;
  notes: string[];
}
```

---

## Database Table Suggestions

Initial tables:

```txt
games
live_game_snapshots
live_pitch_events
mlb_at_bat_snapshots
player_stat_snapshots
spray_profiles
fielder_oaa
sprint_speed_snapshots
league_averages_snapshots
challenge_recommendations
postgame_challenge_audits
player_ranking_totals
team_ranking_totals
ingestion_runs
```

**Removed:** `savant_pitch_events` (legacy; postgame audit uses `live_pitch_events` pitch location).

### `games`

Stores game-level metadata.

Useful fields:

```txt
game_pk
game_date
home_team_id
away_team_id
status
created_at
updated_at
```

### `live_game_snapshots`

Stores game state at the time it was fetched.

Useful fields:

```txt
game_pk
inning
half_inning
outs
balls
strikes
runner_on_first
runner_on_second
runner_on_third
home_score
away_score
batter_id
pitcher_id
batting_team_id
fielding_team_id
fetched_at
raw_payload_id
```

### `live_pitch_events`

Stores pitch-level live events from MLB.

Useful fields:

```txt
game_pk
play_id
at_bat_index
pitch_number
batter_id
pitcher_id
inning
half_inning
balls_before
strikes_before
outs_before
balls_after
strikes_after
outs_after
call_code
call_description
fetched_at
raw_payload_id
```

### `challenge_recommendations`

Stores the system output at the time of the decision.

Useful fields:

```txt
game_pk
pitch_id
recommendation
minimum_confidence_required
expected_value
score
explanation_json
created_at
```

### `postgame_challenge_audits`

Stores postgame evaluation results.

Useful fields:

```txt
game_pk
pitch_id
call_was_probably_wrong
should_have_challenged
missed_challenge
bad_challenge_allowed
run_expectancy_swing
notes_json
created_at
```

---

## Coding Guidelines

### Prefer clean boundaries

Source-specific data should be converted into internal domain types before reaching the engine.

Good:

```txt
MLB raw response
  -> MlbLivePitchEvent
  -> GameStateContext
  -> ChallengeDecisionInput
```

Bad:

```txt
MLB raw response
  -> Challenge engine directly
```

### Store raw data

For external APIs, keep the raw payload or raw row when possible.

This helps with:

- Debugging parser errors
- Replaying ingestion
- Backfilling new fields
- Auditing recommendations
- Testing model changes

### Keep the engine pure

The engine should be easy to test.

Good:

```ts
const decision = decideChallenge(input);
```

Bad:

```ts
const decision = await decideChallenge(gamePk);
```

The engine should not fetch data, write to the database, or call APIs.

### Separate ingestion from decision-making

Ingestion should collect data.

The engine should make decisions.

The backend should coordinate the two.

### Avoid frontend dependency on raw data

The frontend should consume DTOs or view models. It should not know about MLB Live API field names or Savant CSV column names.

---

## Development Phases

### Phase 1: Live Ingestion

Build the MLB live ingestion pipeline.

Focus on:

- Finding active games
- Polling live game feed
- Parsing game state
- Parsing pitch events
- Storing snapshots
- Deduplicating pitch events

Do not worry about Savant yet.

### Phase 2: Pregame Context

Add player and team context.

Focus on:

- Hitter stats
- Pitcher stats
- Handedness
- Splits
- Defensive context
- Run expectancy tables

**Defensive, spray, sprint, and league averages — wired end-to-end:**

`SavantDailyJob` fetches batter stat lines, spray profiles, fielder OAA, sprint speed, league averages, and pitcher pitch mix. The orchestrator persists these to dedicated tables (`spray_profiles`, `fielder_oaa`, `sprint_speed_snapshots`, `league_averages_snapshots`, etc.). `challengeInputBuilder` loads them into `ChallengeDecisionInput`, and the engine applies `defensiveContext`, `baserunningContext`, `lineupContext`, and injected `leagueAverages` multipliers in `decideChallenge`.

### Phase 3: Basic Recommendation Engine

Build a rule-based challenge engine.

Focus on:

- Count leverage
- Runners on base
- Innings left
- Run differential
- Challenges remaining
- Player confidence
- Expected run value

### Phase 4: Backend and Frontend Integration

Expose recommendations through the backend and display them in the frontend.

Focus on:

- Recommendation endpoint
- Challenge card UI
- Explanation display
- Game situation display

**OAA, spray, lineup, baserunning, and league averages (complete):** see Phase 2 note above and `engine/src/features/`.

### Phase 5: Postgame Challenge Audit (complete)

Audit missed opportunities and bad challenges using MLB live feed pitch location — no Savant CSV wait.

Focus (implemented):

- Join `live_pitch_events` pitch location to at-bat snapshots
- Audit **batting** (called strikes) and **fielding** (called balls) for zone disagreements
- Compute missed value from **zone-calculated raw RE swing** (not gated on ALLOW/DENY)
- Flag bad challenges when DENY/WARN was shown live
- Increment player/team rankings; serve `GET /api/games/:gamePk/postgame-audit`

**Phase 6 status (complete):** 7-day schedule slider, About, How it works, postgame per-team splits, and **rolling 7-day + season challenge rankings** at `/rankings` (Players | Teams, Last 7 days | Season).

### Phase 6: Product Quality of Life

Frontend and API polish after the live + postgame core is working. Build these **before** engine tuning so the product is usable and explorable while audit data accumulates.

Focus on:

- **Recent games (7-day window)** — Dashboard or schedule view showing tracked games from the last 7 days when they exist in the DB (aligned with `DATA_RETENTION_DAYS` default). Today’s live games remain primary; past days are browsable without re-polling MLB.
- **Challenge rankings — players & teams** — `/rankings` with **Players | Teams** and **Last 7 days | Season** toggles. The 7-day view is a **rolling window** (today plus the prior 6 days), aligned with `DATA_RETENTION_DAYS` and the schedule slider — not calendar weeks. Season totals accumulate from `TRACKING_START_DATE` with **running rates** (overturn % = total overturned ÷ total used).
- **About page** — Static page: what the project is, data sources (MLB live feed, Savant), disclaimer that recommendations are strategic guidance not real-time zone calls.
- **How it works page** — Static page walking through the pipeline (ingest → precompute → called-strike trigger → recommendation labels) and how to read the UI (count grid, live card, history, postgame audit when available).

Backend: `GET /api/rankings` (bundle) or `/players` / `/teams` with `?period=week|season`. Week mode sums **day buckets** over the rolling `DATA_RETENTION_DAYS` window (default 7). Season mode reads **running season totals** incremented on each challenge/audit. Rankings update incrementally when a review resolves live or when postgame audit completes (including backfill); startup backfill catches any missed rows idempotently.

**Production note (All-Star deploy):** Set `DATA_RETENTION_DAYS` high enough to retain all tracked games for season rankings (e.g. `120`). Set `TRACKING_START_DATE` to the first date the system tracked games.

### Phase 7: Model Improvement

Use postgame audit data to improve the recommendation engine. Defer until Phase 5 audits and Phase 6 product surfaces exist so tuning has data to validate against.

Focus on:

- Threshold tuning
- Historical backtesting
- Feature importance
- Optional machine learning model

See **Future Engine Calculation Features (Phase 7+)** below for remaining modelling gaps (batter count-state splits, optional RE table refresh).

### Phase 8: Game Branches (Client-Only) — complete

Users **branch** a live or final game into a personal sandbox stored only in the browser.

**Implemented:**

- **Export API** — `GET /api/games/:gamePk/export` and `GET /api/games/:gamePk/branch-eligibility`
- **Local storage** — `frontend/src/gameBranch/storage/` with quota, import/export JSON, max branch slots
- **Branch editor** — `/games/:gamePk/branch/:branchId` with lineup, defense, runners, plays, and real-time engine preview
- **Live decision-making** — when the user enters or updates game state (count, bases, outs, score, matchups, challenges), `POST /api/branch/:branchId/preview-grid` runs the same `decideChallenge` pipeline and returns a fresh 12-count grid; useful for manual pitch-by-pitch tracking without MLB live polling
- **Branch list** — `/branches` route for saved local branches
- **Canonical games** remain read-only on the server; branch edits never write to the DB

---

## Current Status (as of July 2026)

The full stack runs end-to-end for live ABS challenge guidance, postgame audit, rankings, and local game branches.

### Data pipeline

- **`LivePollJob`** — polls active MLB games; ingests pitch events with plate location, zone metadata, and ABS `reviewDetails` when present.
- **`SavantDailyJob`** — daily ingest of batter stat lines, spray profiles, fielder OAA, sprint speed, **league averages** (persisted + hydrated on backend startup), and pitcher pitch mix.
- **Postgame audit** — runs shortly after Final using stored MLB live feed location data (no Savant CSV wait).

### Backend

- Pre-computes 12-count recommendation grids per at-bat; triggers on called strikes.
- Builds full `ChallengeDecisionInput` (lineup due-up, spray/OAA defense, baserunning sprint, daily league baselines, live handedness).
- **`postgameAuditService`** — batting + fielding zone audits; missed value from zone-calculated RE (not ALLOW-gated).
- **Pitcher challenge hints** — display-only season pitch-mix context on live/pre-at-bat responses.
- **Rankings** — incremental player/team aggregates (missed RE, batting/fielding gained RE, challenge success %).
- **Branch export** — read-only game bundles for client-side forks.

### Engine (`@abs/engine`)

- `decideChallenge` with credibility, offensive value, lineup context, defensive context, baserunning context, scarcity, and optional injected league averages.
- Postgame audit logic lives in the backend (`postgameAuditService`), not the engine package.

### Frontend routes

| Route | Purpose |
|-------|---------|
| `/` | 7-day schedule browser + tracked game cards |
| `/games/:gamePk` | Live card, count grid, history, hints, postgame audit |
| `/games/:gamePk/branch/:branchId` | Local branch editor |
| `/branches` | Saved local branches (import/export) |
| `/rankings` | Player & team leaderboards (7-day + season) |
| `/about`, `/how-it-works` | Product documentation |

### Missed value definition

Sum of `runExpectancySwing` for all `missedChallenge` rows where the zone disagreed with the live call and overturning would add positive RE. Includes cases where the team was out of challenges. Live ALLOW/DENY labels are stored for context but **do not gate** whether a miss is counted.

### Deploy checklist

1. Run Prisma migrations (`league_averages_snapshots`, fielding postgame audit columns, etc.).
2. `npm run pipeline:build` and rebuild engine before restarting backend.
3. Set `DATA_RETENTION_DAYS` (e.g. `120`) and `TRACKING_START_DATE` for season rankings after a DB reset.

**Next up:** Phase 7 (engine tuning / batter count-state splits / optional ML). Static RE24 and count-delta tables still use compile-time constants.

---

## Challenge Rankings (Phase 6)

**Routes:** `GET /api/rankings/players`, `GET /api/rankings/teams`

| Param | Values | Default |
|-------|--------|---------|
| `period` | `week` (rolling last N days), `season` | `week` |

Optional `sort` / `order` query params still work on the API for external clients. The web UI fetches unsorted rows once per period and sorts in the browser.

| Param | Values | Default |
|-------|--------|---------|
| `sort` | `missedRe`, `gainedRe`, `challengeSuccess` | `missedRe` |
| `order` | `desc`, `asc` | `desc` |

- **Missed RE:** run expectancy left on the table (postgame audit), split into batting and fielding columns. Fielding misses credit the catcher, not the pitcher. Default sort uses combined total for players; team sort still uses batting missed only.
- **Gained RE:** run expectancy captured on successful overturns — split into batting and fielding columns.
- **Challenge success %:** overturned ÷ challenges used; no challenges = — (sorted last).
- **Deploy:** set `DATA_RETENTION_DAYS` high enough to keep all season games (e.g. `120` through All-Star break); set `TRACKING_START_DATE` to your program start.

---

## Next Features for the Next Agent

### 1. ~~ABS Challenge Outcome Display~~ (done)

`live_pitch_events` stores `hasReview`, `isOverturned`, `challengerName`, and `challengerTeamId` from MLB `reviewDetails`. At-bat history shows challenge badges with challenger and overturn status.

### 2. ~~Wire OAA + Spray Profiles into the Engine~~ (done)

Spray profiles, fielder OAA, defensive context, lineup due-up window, baserunning sprint speed, and daily league averages are wired end-to-end.

### 3. ~~Phase 5: Postgame challenge audit~~ (done)

Postgame audit uses MLB live feed pitch location. Audits batting (called strikes) and fielding (called balls). Missed value uses zone-calculated RE, not ALLOW gating.

### 4. ~~Phase 6: Product quality of life~~ (done)

7-day schedule browser, About, How it works, postgame per-team splits, pitcher challenge hints, and `/rankings` (7-day + season, players + teams).

### 5. ~~Phase 8: Game branches (client-only)~~ (done)

Local-storage branches with import/export, branch editor, preview grids, and `/branches` list. See Phase 8 under Development Phases.

### 6. Phase 7: Engine tuning (remaining)

**Priority — wire `SavantLineupJob` for batter count-state splits.**

**Full implementation prompt:** [`docs/PHASE7_SAVANT_LINEUP_JOB.md`](docs/PHASE7_SAVANT_LINEUP_JOB.md)

Also on the backlog:

- Threshold tuning and backtesting against accumulated audit data
- Optional: refresh static RE24 / count-delta tables from daily data
- Optional machine learning model

---

### Phase 7 plan: Wire SavantLineupJob (batter count-state splits)

See **[docs/PHASE7_SAVANT_LINEUP_JOB.md](docs/PHASE7_SAVANT_LINEUP_JOB.md)** for the full agent handoff (schema, orchestrator hook, engine changes, tests, checklist).

**Goal:** Replace the engine’s fixed count modifier with batter-specific performance by count state.

**Not the same as lineup due-up context** — `lineupContext.ts` already uses batting order + daily OPS/wOBA for upcoming batters. `SavantLineupJob` supplies pitch-by-pitch history for “how does *this* batter hit at *this* count?”

**Defer:** `SavantPostgameJob` — postgame audit uses MLB live feed only.

---

## Future Engine Calculation Features (Phase 7+)

Most pregame context is wired. Remaining gaps extend beyond league-average count heuristics.

### Upcoming batters window (lineup context)

**Status:** Implemented — `lineupContext.ts` + batting order from live feed / DB.

**Behavior:** When deciding whether the current batter should challenge, the engine accounts for batters due up later this half-inning (window keyed to outs remaining). Strong hitters on deck increase the value of keeping the current batter alive via a successful challenge.

---

### Batter performance by count state

**Status:** Planned — `SavantLineupJob` built and tested; not wired. **Agent handoff:** [`docs/PHASE7_SAVANT_LINEUP_JOB.md`](docs/PHASE7_SAVANT_LINEUP_JOB.md).

**Goal:** Batters perform very differently by count (0-1, 0-2, 1-2, etc.). Use **historical count splits** (wOBA, K%, chase%, whiff%, etc.) to adjust challenge value and credibility for the specific batter at the specific count.

**What exists today:**

- `playerCredibility.ts` applies a **fixed** count modifier for all batters (pitcher-behavior logic, not batter skill by count).
- The run-expectancy table includes generic count-based RE adjustments.
- `lineupContext.ts` handles **upcoming batters’ season quality** — separate from count splits.

**Planned (SavantLineupJob):**

- Run at lineup confirmation; rollup pitch history into per-batter count buckets.
- Replace or blend the fixed count modifier with batter-specific signals in credibility and/or offensive value.

---

### Runner speed and base-path value

**Status:** Implemented — `baserunningContext.ts` + `sprint_speed_snapshots` from daily ingest.

**Behavior:** When runners are on base (especially on a 3-ball count where a walk is possible), sprint speed vs league average adjusts the run-expectancy multiplier.

---

### Static RE tables and league baselines

**Status:** Partial — daily `leagueAverages` injection covers chase, walk, K, whiff, OPS, wOBA, batted-ball mix, and sprint baselines. RE24 matrix and count-delta tables remain compile-time constants in the engine.

**Planned:** Optionally refresh RE24 / count deltas from rolling season data.

---

### Summary table

| Feature | In pipeline? | In engine? | Notes |
|--------|--------------|------------|-------|
| Upcoming batters window | Yes | Yes | `lineupContext.ts` + batting order |
| Batter count-state splits | Yes (`SavantLineupJob`, unwired) | Partial (fixed count modifier only) | Phase 7 — see README plan |
| Runner sprint speed | Yes | Yes | `baserunningContext.ts` |
| Daily league averages | Yes | Yes | Injected via `leagueAveragesStore` |
| RE24 / count-delta tables | N/A | Static constants | Optional daily refresh |

---

## Live Polling Intervals (current implementation)

```txt
Pregame / Warmup:  every 5 minutes
In Progress:       every 15 seconds   (reduced from 30 s to catch fast at-bats)
Between innings:   every 30 seconds
Error retry:       every 10 seconds
Game check:        every 5 minutes    (LivePollJob discovers new games)
```

---

## Summary

This project is a challenge permission and recommendation system, not just a pitch accuracy system.

The live system should answer:

> Is this challenge worth using right now?

The postgame system should answer:

> Did we make the right challenge decisions?

The system should keep live ingestion, decision logic, backend APIs, frontend display, and postgame analysis clearly separated.