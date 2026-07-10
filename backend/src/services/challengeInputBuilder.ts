/**
 * Builds ChallengeDecisionInput payloads for at-bat pre-computation.
 *
 * Loads player context, lineup, baserunning, and RE expectancies from DB
 * snapshots and stat tables. Pure engine calls (decideChallenge) stay in
 * challengeService.
 */

import {
  computeChallengeOutcomeExpectancies,
  buildDueUpWindow,
  toOuts,
  type GameStateContext,
  type PitchCallContext,
  type ChallengeDecisionInput,
  type BaserunningContextInput,
  type LineupContextInput,
  type DueUpBatter,
  type PlayerChallengeContext,
  type Balls,
  type Strikes,
} from "@abs/engine";
import type { MlbAtBatSnapshot, DefensiveLineup } from "@abs/data-pipeline";
import { SEASONS } from "../db/constants";
import { computeTeamChallengesRemaining } from "../db/gameRepository";
import { findPlayerStatSnapshot, findPlayerStatSnapshotBatch } from "../db/playerRepository";
import { findSprayProfile } from "../db/defensiveRepository";
import { findSprintSpeedBatch } from "../db/sprintSpeedRepository";
import { findBattingOrder } from "../db/lineupRepository";
import {
  buildPlayerChallengeContext,
  buildDefaultPlayerChallengeContext,
} from "./playerContextBuilder";
import { resolveFielderOaa } from "./fielderOaaResolver";
import { getLeagueAveragesForEngine } from "./leagueAveragesStore";

/** Shared context computed once per at-bat, reused for all 12 count states. */
export interface AtBatChallengeContext {
  challengesRemaining: number;
  challengeAvailable: boolean;
  runDifferential: number;
  playerContext: PlayerChallengeContext;
  pitchContext: PitchCallContext;
  baserunningContext: BaserunningContextInput;
  lineupContext: LineupContextInput | undefined;
  runners: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
}

/** Optional overrides for branch preview (no DB challenge derivation). */
export interface ChallengeContextOptions {
  challengesRemainingOverride?: number;
  battingOrderOverride?: number[];
  defenseOverride?: DefensiveLineup;
}

/**
 * Load all shared inputs for an at-bat: player stats, lineup, baserunning,
 * fielder OAA, and challenge availability.
 */
export async function buildAtBatChallengeContext(
  snapshot: MlbAtBatSnapshot,
  options?: ChallengeContextOptions
): Promise<AtBatChallengeContext> {
  const challengesRemaining =
    options?.challengesRemainingOverride ??
    (await computeTeamChallengesRemaining(
      snapshot.gamePk,
      snapshot.battingTeamId,
      snapshot.inning
    ));

  const challengeAvailable = challengesRemaining > 0;

  const runDifferential =
    snapshot.halfInning === "top"
      ? snapshot.awayScore - snapshot.homeScore
      : snapshot.homeScore - snapshot.awayScore;

  const statSnapshot = await findPlayerStatSnapshot(snapshot.batterId, SEASONS.CURRENT);
  const sprayProfile = await findSprayProfile(snapshot.batterId, SEASONS.CURRENT);

  const battingHand = statSnapshot?.battingHand ?? null;
  const fielderOaa = await resolveFielderOaa(
    options?.defenseOverride ?? snapshot.defense,
    sprayProfile,
    battingHand
  );

  const playerContext = statSnapshot
    ? buildPlayerChallengeContext(statSnapshot, sprayProfile, fielderOaa)
    : buildDefaultPlayerChallengeContext(snapshot.batterId);

  const baserunningContext = await resolveBaserunningContext(snapshot);

  const battingOrder =
    options?.battingOrderOverride ??
    snapshot.battingOrder ??
    (await findBattingOrder(snapshot.gamePk, snapshot.battingTeamId));

  const lineupPlayerIds = buildDueUpWindow(
    battingOrder,
    snapshot.batterId,
    toOuts(snapshot.outs)
  );

  const lineupStatRows = await findPlayerStatSnapshotBatch(
    lineupPlayerIds,
    SEASONS.CURRENT
  );
  const lineupStatById = new Map(lineupStatRows.map((row) => [row.playerId, row]));

  const dueUpBatters: DueUpBatter[] = lineupPlayerIds.map((playerId) => {
    const row = lineupStatById.get(playerId);
    return {
      playerId,
      ops: finiteStat(row?.ops),
      woba: finiteStat(row?.woba),
    };
  });

  const lineupContext: LineupContextInput | undefined =
    dueUpBatters.length > 0 ? { dueUpBatters } : undefined;

  const pitchContext: PitchCallContext = {
    callType: "called_strike",
    pitcherHandedness: null,
  };

  return {
    challengesRemaining,
    challengeAvailable,
    runDifferential,
    playerContext,
    pitchContext,
    baserunningContext,
    lineupContext,
    runners: {
      first: snapshot.runnerOnFirst,
      second: snapshot.runnerOnSecond,
      third: snapshot.runnerOnThird,
    },
  };
}

/**
 * Build a full ChallengeDecisionInput for one count state using shared at-bat context.
 */
export function buildChallengeInputForCount(
  snapshot: MlbAtBatSnapshot,
  balls: Balls,
  strikes: Strikes,
  ctx: AtBatChallengeContext
): ChallengeDecisionInput {
  const gameState: GameStateContext = {
    gamePk: snapshot.gamePk,
    inning: snapshot.inning,
    halfInning: snapshot.halfInning,
    balls,
    strikes,
    outs: toOuts(snapshot.outs),
    runnerOnFirst: snapshot.runnerOnFirst,
    runnerOnSecond: snapshot.runnerOnSecond,
    runnerOnThird: snapshot.runnerOnThird,
    homeScore: snapshot.homeScore,
    awayScore: snapshot.awayScore,
    runDifferentialForBattingTeam: ctx.runDifferential,
    battingTeamId: snapshot.battingTeamId,
    fieldingTeamId: snapshot.fieldingTeamId,
    batterId: snapshot.batterId,
    pitcherId: snapshot.pitcherId,
    challengesRemaining: ctx.challengesRemaining,
  };

  const reValues = computeChallengeOutcomeExpectancies(
    gameState.outs,
    gameState.balls,
    gameState.strikes,
    ctx.runners
  );

  return {
    gameState,
    playerContext: ctx.playerContext,
    pitchContext: ctx.pitchContext,
    currentRunExpectancy: reValues.current,
    runExpectancyIfSuccessful: reValues.ifSucceeds,
    runExpectancyIfFailed: reValues.ifFails,
    baserunningContext: ctx.baserunningContext,
    lineupContext: ctx.lineupContext,
    leagueAverages: getLeagueAveragesForEngine(),
  };
}

async function resolveBaserunningContext(
  snapshot: MlbAtBatSnapshot
): Promise<BaserunningContextInput> {
  const runnerIds = snapshot.runnerIds ?? {};
  const speedPlayerIds = [
    snapshot.batterId,
    runnerIds.first,
    runnerIds.second,
    runnerIds.third,
  ].filter((id): id is number => id !== undefined);

  const speedRows = await findSprintSpeedBatch(speedPlayerIds, SEASONS.CURRENT);
  const speedById = new Map(speedRows.map((row) => [row.playerId, row.sprintSpeed]));

  return {
    runnerIds,
    batterSprintSpeed: speedById.get(snapshot.batterId) ?? null,
    runnerSprintSpeeds: {
      first:
        runnerIds.first !== undefined
          ? speedById.get(runnerIds.first) ?? undefined
          : undefined,
      second:
        runnerIds.second !== undefined
          ? speedById.get(runnerIds.second) ?? undefined
          : undefined,
      third:
        runnerIds.third !== undefined
          ? speedById.get(runnerIds.third) ?? undefined
          : undefined,
    },
  };
}

function finiteStat(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}
