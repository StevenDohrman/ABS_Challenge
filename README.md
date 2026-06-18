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
- Which players are reliable when signaling confidence?
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
- Player-submitted confidence

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
- Defensive metrics such as Outs Above Average in locations and where the batter usually gets hits
- Run expectancy tables
- Win probability inputs, if available

### Postgame Data

Baseball Savant should be used for postgame enrichment and analysis.

Postgame analysis can answer:

- Which pitches should have been challenged?
- Which allowed challenges were bad decisions?
- Which players were accurate when reporting confidence?
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
- Managing player confidence submissions

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
- Collecting player confidence
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
8. Collect player confidence.
9. Send clean input to challenge engine.
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
player_confidence_inputs
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

### `player_confidence_inputs`

Stores player or coach confidence signals.

Useful fields:

```txt
game_pk
pitch_id
player_id
confidence
submitted_at
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
- Player confidence input
- Challenge card UI
- Explanation display
- Game situation display

### Phase 5: Postgame Savant Analysis

Add Baseball Savant postgame enrichment.

Focus on:

- Pulling Savant pitch rows
- Joining to live pitch events
- Detecting missed challenge opportunities
- Detecting bad allowed challenges
- Building audit reports

### Phase 6: Model Improvement

Use postgame audit data to improve the recommendation engine.

Focus on:

- Threshold tuning
- Player-specific confidence calibration
- Historical backtesting
- Feature importance
- Optional machine learning model

---

## Current Priority

The current priority is the data ingestion engine.

Focus only on:

```txt
1. MLB live game polling
2. Live game state normalization
3. Pitch event normalization
4. Pregame player context ingestion
5. Database storage
6. Clean mapping into engine-ready types
```

Baseball Savant should be added later for postgame analysis, not as part of the real-time decision loop.

---

## Summary

This project is a challenge permission and recommendation system, not just a pitch accuracy system.

The live system should answer:

> Is this challenge worth using right now?

The postgame system should answer:

> Did we make the right challenge decisions?

The system should keep live ingestion, decision logic, backend APIs, frontend display, and postgame analysis clearly separated.