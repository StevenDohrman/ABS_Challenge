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

The live engine should not depend on Baseball Savant pitch-location data because Savant is not treated as the real-time source for this system. However it can be used for postgame analysis such as missed challenge opportunities based on pitch locations.

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
- Run expectancy tables
- Win probability inputs, if available

All of the above defensive and spray metrics are already fetched daily by `SavantDailyJob`. They are pregame computations keyed to the players confirmed in the lineup, so no additional API calls are required at decision time — the data simply needs to be stored and wired into the engine.

### Postgame Data

Baseball Savant should be used for postgame enrichment and analysis.

Postgame analysis can answer:

- Which pitches should have been challenged?
- Which allowed challenges were bad decisions?
- Which game states produced missed challenge opportunities?
- How should thresholds be adjusted in the future?

Postgame Savant data may include:

- Pitch location
- Strike zone boundaries
- Final pitch result
- Statcast pitch data
- Batted-ball data
- Expected batting metrics

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

  shared/
    src/
      types/
      constants/
      schemas/
```

---

## Package Responsibilities

### `shared`

The `shared` package contains stable types, constants, and schemas used across multiple parts of the project.

Use `shared` for general baseball primitives such as:

- Player IDs
- Team IDs
- Game IDs
- Base occupancy
- Handedness
- Half inning
- Pitch call categories
- Challenge recommendation labels


Avoid putting everything in `shared`. Only place a type in `shared` if more than one major package needs it.

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
shared
  -> engine
  -> backend

shared
  -> data-pipeline
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
shared = common language
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

  savantZoneResult: "ball" | "strike" | "unknown";
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
player_stat_snapshots
challenge_recommendations
savant_pitch_events
postgame_challenge_audits
ingestion_runs
```

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

### `savant_pitch_events`

Stores postgame Savant pitch data.

Useful fields:

```txt
game_pk
at_bat_number
pitch_number
batter_id
pitcher_id
plate_x
plate_z
sz_top
sz_bot
description
zone
fetched_at
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

**Defensive and spray data — already fetched, not yet wired:**

`SavantDailyJob` already fetches and emits batter spray profiles, fielder OAA, and sprint speed. The data pipeline does its job. What is missing is:

1. Storage — `player_stat_snapshots` does not have OAA or spray columns. A new table or additional columns are needed.
2. Orchestrator handlers — `batterStatlines`, `sprayProfiles`, and `fielderOaa` are wired; sprint speed is fetched but not yet stored.
3. Engine input — `PlayerChallengeContext` has no OAA or spray fields. New fields and a new feature computation module are needed.
4. RE delta adjustment — the current RE table uses league-average defensive conversion rates. OAA and spray data would allow a small multiplier correction: a pull-heavy batter facing an elite fielder in the pull zone is worth less to keep at the plate than the raw RE table implies.

This is low-cost incremental work because all the data is already available at decision time.

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

**Wire OAA and spray profiles into the live engine (Phase 4 scope):**

This belongs in Phase 4 rather than Phase 7 because the data is already ingested by the pipeline — it is a wiring task, not a modelling task.

Steps:

1. Add `spray_profiles` and `fielder_oaa` tables (or extend `player_stat_snapshots`) in the Prisma schema.
2. Register `sprayProfiles` and `fielderOaa` handlers in `orchestrator.ts` to write the emitted data to those tables.
3. Add `sprayProfile` and `defensiveOaa` fields to `PlayerChallengeContext` in the engine.
4. Create a `defensiveContext.ts` feature module in the engine that computes a small RE delta multiplier from the batter's spray tendencies and the relevant fielder's OAA.
5. Apply the multiplier inside `decideChallenge` after the offensive value step.

The expected effect is small — a ±5–10% correction to the RE delta — but it moves the system toward a more accurate expected value in situations where the defense is clearly elite or clearly poor in the batter's spray zone.

### Phase 5: Postgame Savant Analysis

Add Baseball Savant postgame enrichment.

Focus on:

- Pulling Savant pitch rows
- Joining to live pitch events
- Detecting missed challenge opportunities
- Detecting bad allowed challenges
- Building audit reports

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

See **Future Engine Calculation Features (Phase 7+)** below for planned engine inputs (lineup window, count splits, sprint speed) that belong in this phase.

### Phase 8: Forked Game Branches (Client-Only)

Let users **fork** a live or final game into a personal **branch** they can edit locally — alternate challenge counts, at-bat outcomes, or “what if” recommendation paths — without writing to the server DB or re-running the engine on the backend.

**Design constraints:**

- **Local storage only** — forked games live in the browser (`localStorage` and/or `IndexedDB` for larger payloads). No new Prisma tables, no fork persistence on Supabase.
- **Fork from canonical game** — snapshot the current API payload for a `gamePk` (schedule header, at-bat snapshots, pitch events, 12-count recommendation grids, optional postgame audit rows) into a versioned JSON document with a new `forkId` and `parentGamePk`.
- **Editable branch state** — user adjusts challenge counts remaining, marks pitches as challenged/overturned, or toggles which count was “triggered” on an at-bat; UI recomputes display-only summaries (e.g. hypothetical missed value) in the client without calling `decideChallenge` on the server.
- **Import / export** — download fork as `.json`; import restores into local storage (validate schema version, merge or replace by `forkId`).
- **Clear separation in UI** — forked games show a “LOCAL FORK” badge; canonical DB games remain read-only except for live polling.

**Suggested scope:**

1. **Export API (read-only)** — optional `GET /api/games/:gamePk/export` returning a single bundle for forking (or reuse existing history + audit endpoints from the client).
2. **Frontend fork store** — `forkStorage.ts` with CRUD, quota handling, and schema version.
3. **Fork detail view** — reuse `GameDetailScreen` / `AtBatHistory` / `CountGrid` with a `mode: "canonical" | "fork"` prop; edits write to local fork only.
4. **Fork list** — `/forks` route showing saved local branches with link back to parent `gamePk`.

Defer heavy client-side engine recompute until Phase 7; Phase 8 can start with manual edits + static grids from the fork snapshot.

---

## Current Status (as of June 2026)

Phase 6 is complete. The full stack runs end-to-end including postgame Savant audits and challenge rankings:

- **Data pipeline**: `LivePollJob` polls active games; `SavantPostgameJob` waits **14 hours after Final**, then polls every 10 min for up to 8 hours.
- **Backend**: pre-computes 12-count grids, triggers called-strike recommendations, persists `savant_pitch_events` and `postgame_challenge_audits`, serves `GET /api/games/:gamePk/postgame-audit`.
- **Engine**: unchanged — audit logic lives in `postgameAuditService` (not the engine).
- **Frontend**: React Router (`/`, `/games/:gamePk`, `/about`, `/how-it-works`, `/rankings`). Final games show postgame audit summary (total value missed, top 3 missed, expandable full list) plus at-bat history with Savant missed badges. Rankings page: weekly + season, players + teams.

**Missed value definition:** sum of `runExpectancySwing` for all `missedChallenge` rows — includes cases where the team was out of challenges (strategic miss from earlier bad challenges).

**Next up:** Phase 7 (engine tuning), then Phase 8 (client-only forked game branches). Phase 6 rankings ship at `/rankings` (weekly + season, players + teams).

---

## Challenge Rankings (Phase 6)

**Routes:** `GET /api/rankings/players`, `GET /api/rankings/teams`

| Param | Values | Default |
|-------|--------|---------|
| `period` | `week` (rolling last N days), `season` | `week` |

Optional `sort` / `order` query params still work on the API for external clients. The web UI fetches unsorted rows once per period and sorts in the browser.

| Param | Values | Default |
|-------|--------|---------|
| `sort` | `missedRe`, `challengeSuccess` | `missedRe` |
| `order` | `desc`, `asc` | `desc` |

- **Missed RE:** batting-side run expectancy left on the table (postgame audit).
- **Challenge success %:** overturned ÷ challenges used; no challenges = — (sorted last).
- **Deploy:** set `DATA_RETENTION_DAYS` high enough to keep all season games (e.g. `120` through All-Star break); set `TRACKING_START_DATE` to your program start.

---

## Next Features for the Next Agent

### 1. ABS Challenge Outcome Display

The MLB Stats API already records ABS challenge results on pitch events. No new API calls are needed — the data is already stored in `live_pitch_events.rawPayload`.

**What the API gives you (confirmed from real game data):**

Each challenged pitch has `details.hasReview: true` and a `reviewDetails` object:

```json
{
  "isOverturned": true,
  "inProgress": false,
  "reviewType": "MJ",
  "challengeTeamId": 111,
  "player": {
    "id": 678882,
    "fullName": "Ceddanne Rafaela"
  }
}
```

- `hasReview` — the pitch was challenged
- `isOverturned` — whether the original call was reversed
- `challengeTeamId` — which team challenged (compare to `battingTeamId` / `fieldingTeamId` to determine batter-side vs pitcher-side)
- `player` — the exact player who triggered the challenge

**Implementation steps:**

1. **Type**: Add `reviewDetails` to `MlbPlayEvent` in `data-pipeline/src/sources/mlb-live/mlbLive.api.types.ts`:
   ```ts
   reviewDetails?: {
     isOverturned: boolean;
     inProgress: boolean;
     reviewType: string;
     challengeTeamId: number;
     player: { id: number; fullName: string; link: string };
   };
   ```

2. **Internal type**: Add `hasReview`, `isOverturned`, `challengerName`, `challengerTeamId` to `MlbLivePitchEvent` in `mlbLive.types.ts`.

3. **Parser**: Propagate from `MlbPlayEvent.reviewDetails` in `parsePitchEventsFromPlay` inside `mlbLive.parser.ts`.

4. **DB schema**: Add `hasReview Boolean @default(false)`, `isOverturned Boolean?`, `challengerName String?`, `challengerTeamId Int?` columns to `LivePitchEvent` in `prisma/schema.prisma` and run `prisma migrate dev`.

5. **DTO**: Extend `AtBatHistoryItemDto` in `challenge.dto.ts` to include challenge outcome per at-bat.

6. **Frontend**: In the at-bat history view (`AtBatHistory.tsx`), show a challenge badge on rows where `hasReview` is true — display the challenger's name, which side challenged, and whether it was overturned. This is already a requested feature.

### 2. ~~Wire OAA + Spray Profiles into the Engine~~ (done)

Spray profiles, fielder OAA, and per-fielder defensive context are wired end-to-end. See **Future Engine Calculation Features** below for the next modelling gaps (lineup window, count splits, sprint speed).

### 3. Phase 5: Postgame Savant Enrichment

Pull Savant pitch-location data after game completion, join to `live_pitch_events`, and populate `postgame_challenge_audits` to audit missed challenges and bad allowed challenges.

### 4. ~~Phase 6: Product quality of life~~ (done)

7-day game browser, About, How it works, postgame per-team splits, and `/rankings` (weekly + season, players + teams).

### 5. Phase 8: Forked game branches (client-only)

See **Phase 8** under Development Phases. Local-storage forks with import/export; no DB persistence.

---

## Future Engine Calculation Features (Phase 7+)

These are **not implemented yet** (except where noted). They extend the challenge engine beyond the current batter-only, league-average count heuristics. Do not build them until Phase 5 audit data is in place and Phase 6 product surfaces exist unless explicitly prioritized.

### Upcoming batters window (lineup context)

**Status:** Planned — not in engine or live feed parsing today.

**Goal:** When deciding whether the current batter should challenge, account for who is likely to bat later this half-inning. Use a sliding window keyed to outs remaining:

- Example: 2 outs left → consider the current batter plus the next 2 batters due up.
- If the current batter reaches base safely, the window slides forward (same outs, new batter at the plate, next batters still in the queue).
- Weight upcoming batters' offensive profiles (OPS, wOBA, etc.) to adjust how valuable it is for the **current** batter to stay alive or reach base via a successful challenge — extending the inning for a strong on-deck hitter is worth more than doing so for a weak tail of the order.

**Current system:** `offensiveValue.ts` only scales the run-expectancy delta for the **current** batter. No batting order, on-deck, or “due up this inning” context exists in `GameStateContext` or `PlayerChallengeContext`.

**Dependencies (future work):**

- Parse batting order and current spot from the MLB live feed (or a pregame lineup snapshot).
- Pregame stats for every active lineup player (already available via daily ingest; needs per-game lineup binding).
- New engine feature module (e.g. `lineupContext.ts`) and fields on `ChallengeDecisionInput`.

---

### Batter performance by count state

**Status:** Partial — league-average count heuristics only; batter-specific splits planned.

**Goal:** Batters perform very differently by count (0-1, 0-2, 1-2, etc.). Being down in the count is generally bad for the hitter; some batters collapse in 0-2 while others remain dangerous. Use **historical count splits** (wOBA, K%, chase%, whiff%, etc.) to adjust challenge value and credibility for the specific batter at the specific count.

**What exists today:**

- `playerCredibility.ts` applies a **fixed** count modifier for all batters (e.g. 0-2 → slightly higher P(call wrong) because pitchers work the edges; 3-0 → lower because grooved strikes are more likely correct). This is pitcher-behavior logic, not batter skill by count.
- The run-expectancy table includes generic count-based RE adjustments (e.g. 0-2 subtracts ~0.106 runs vs 0-0).
- `SavantLineupJob` can fetch per-player Statcast pitch history at lineup confirmation (includes balls/strikes per pitch) but is **not wired** to the backend or engine.

**Planned:**

- Ingest or compute batter count-state splits (Savant daily aggregates or lineup-time pitch history rollups).
- Replace or blend the fixed count modifier with batter-specific “performance when behind/ahead in the count” signals in credibility and/or offensive value.

---

### Runner speed and base-path value

**Status:** Partial — pipeline fetch only; not stored or used in decisions.

**Goal:** When runners are on base, factor in **sprint speed** (and related base-running value) when estimating how much a successful challenge helps the offense — a fast runner on first increases the value of the batter reaching or staying alive; a slow runner less so.

**What exists today:**

- `SavantDailyJob` fetches the sprint speed leaderboard (`sprintSpeed`, `homeTo1b`, `competitiveRuns`) and emits a `sprintSpeed` event.
- The orchestrator does **not** persist sprint speed; the engine has no runner-quality fields. Run expectancy uses generic base/out states only.

**Planned:**

- Store sprint speed per player (new table or column on `player_stat_snapshots`).
- When `runnerOnFirst` / `runnerOnSecond` / `runnerOnThird` is true, apply a small RE-delta or situation multiplier based on the occupying runner(s)' speed vs league average (~27 ft/s).

---

### Summary table

| Feature | In pipeline? | In engine? | Notes |
|--------|--------------|------------|-------|
| Upcoming batters window | No | No | Needs lineup order + sliding window logic |
| Batter count-state splits | Partial (`SavantLineupJob` exists, unwired) | Partial (fixed count modifier only) | Batter-specific splits are the gap |
| Runner sprint speed | Yes (daily fetch) | No | Needs storage + RE multiplier when runners on |

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