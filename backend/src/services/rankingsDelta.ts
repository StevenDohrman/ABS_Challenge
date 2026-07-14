import { battingSideFromHalfInning } from "../challenge.dto";
import { SEASONS } from "../db/constants";

export interface PlayerBucketDelta {
  playerId: number;
  challengesUsed?: number;
  challengesOverturned?: number;
  missedOpportunities?: number;
  totalMissedValue?: number;
  battingMissedCount?: number;
  battingMissedValue?: number;
  fieldingMissedCount?: number;
  fieldingMissedValue?: number;
  battingGainedRe?: number;
  fieldingGainedRe?: number;
  badChallenges?: number;
}

export interface TeamBucketDelta {
  teamId: number;
  challengesUsed?: number;
  challengesOverturned?: number;
  battingMissedCount?: number;
  battingMissedValue?: number;
  fieldingMissedCount?: number;
  fieldingMissedValue?: number;
  battingGainedRe?: number;
  fieldingGainedRe?: number;
  badChallenges?: number;
}

export interface RankingsEventDelta {
  playerDeltas: PlayerBucketDelta[];
  teamDeltas: TeamBucketDelta[];
  playerAppearanceIds: number[];
}

export interface RankingsGameContext {
  gamePk: number;
  gameDate: string;
  homeTeamId: number;
  awayTeamId: number;
}

export interface PitchReviewContext {
  pitchEventId: number;
  gamePk: number;
  hasReview: boolean;
  isOverturned: boolean | null;
  challengerTeamId: number | null;
  challengerPlayerId: number | null;
  batterId: number;
  halfInning: string;
  gainedRe: number;
}

export interface PostgameAuditContext {
  pitchEventId: number;
  batterId: number;
  pitcherId: number;
  catcherId: number | null;
  halfInning: string;
  challengeSide: "batting" | "fielding";
  missedChallenge: boolean;
  badChallengeAllowed: boolean;
  runExpectancySwing: number;
  challengerPlayerId: number | null;
  challengerTeamId: number | null;
}

export function seasonFromGameDate(gameDate: string): number {
  const year = parseInt(gameDate.slice(0, 4), 10);
  return Number.isFinite(year) ? year : SEASONS.CURRENT;
}

export function battingTeamId(game: RankingsGameContext, halfInning: string): number {
  return battingSideFromHalfInning(halfInning) === "away"
    ? game.awayTeamId
    : game.homeTeamId;
}

export function fieldingTeamId(game: RankingsGameContext, halfInning: string): number {
  return battingTeamId(game, halfInning) === game.awayTeamId
    ? game.homeTeamId
    : game.awayTeamId;
}

function isBattingSideChallenge(
  challengerTeamId: number,
  game: RankingsGameContext,
  halfInning: string
): boolean {
  return challengerTeamId === battingTeamId(game, halfInning);
}

function addPlayerDelta(
  deltas: PlayerBucketDelta[],
  playerId: number,
  patch: Omit<PlayerBucketDelta, "playerId">
): void {
  let row = deltas.find((d) => d.playerId === playerId);
  if (!row) {
    row = { playerId };
    deltas.push(row);
  }
  if (patch.challengesUsed) row.challengesUsed = (row.challengesUsed ?? 0) + patch.challengesUsed;
  if (patch.challengesOverturned) {
    row.challengesOverturned = (row.challengesOverturned ?? 0) + patch.challengesOverturned;
  }
  if (patch.missedOpportunities) {
    row.missedOpportunities = (row.missedOpportunities ?? 0) + patch.missedOpportunities;
  }
  if (patch.totalMissedValue) {
    row.totalMissedValue = (row.totalMissedValue ?? 0) + patch.totalMissedValue;
  }
  if (patch.battingMissedCount) {
    row.battingMissedCount = (row.battingMissedCount ?? 0) + patch.battingMissedCount;
  }
  if (patch.battingMissedValue) {
    row.battingMissedValue = (row.battingMissedValue ?? 0) + patch.battingMissedValue;
  }
  if (patch.fieldingMissedCount) {
    row.fieldingMissedCount = (row.fieldingMissedCount ?? 0) + patch.fieldingMissedCount;
  }
  if (patch.fieldingMissedValue) {
    row.fieldingMissedValue = (row.fieldingMissedValue ?? 0) + patch.fieldingMissedValue;
  }
  if (patch.battingGainedRe) row.battingGainedRe = (row.battingGainedRe ?? 0) + patch.battingGainedRe;
  if (patch.fieldingGainedRe) row.fieldingGainedRe = (row.fieldingGainedRe ?? 0) + patch.fieldingGainedRe;
  if (patch.badChallenges) row.badChallenges = (row.badChallenges ?? 0) + patch.badChallenges;
}

function addTeamDelta(
  deltas: TeamBucketDelta[],
  teamId: number,
  patch: Omit<TeamBucketDelta, "teamId">
): void {
  let row = deltas.find((d) => d.teamId === teamId);
  if (!row) {
    row = { teamId };
    deltas.push(row);
  }
  if (patch.challengesUsed) row.challengesUsed = (row.challengesUsed ?? 0) + patch.challengesUsed;
  if (patch.challengesOverturned) {
    row.challengesOverturned = (row.challengesOverturned ?? 0) + patch.challengesOverturned;
  }
  if (patch.battingMissedCount) {
    row.battingMissedCount = (row.battingMissedCount ?? 0) + patch.battingMissedCount;
  }
  if (patch.battingMissedValue) {
    row.battingMissedValue = (row.battingMissedValue ?? 0) + patch.battingMissedValue;
  }
  if (patch.fieldingMissedCount) {
    row.fieldingMissedCount = (row.fieldingMissedCount ?? 0) + patch.fieldingMissedCount;
  }
  if (patch.fieldingMissedValue) {
    row.fieldingMissedValue = (row.fieldingMissedValue ?? 0) + patch.fieldingMissedValue;
  }
  if (patch.battingGainedRe) row.battingGainedRe = (row.battingGainedRe ?? 0) + patch.battingGainedRe;
  if (patch.fieldingGainedRe) row.fieldingGainedRe = (row.fieldingGainedRe ?? 0) + patch.fieldingGainedRe;
  if (patch.badChallenges) row.badChallenges = (row.badChallenges ?? 0) + patch.badChallenges;
}

/** Build delta for a resolved ABS review on a pitch event. */
export function buildPitchReviewDelta(
  game: RankingsGameContext,
  pitch: PitchReviewContext
): RankingsEventDelta | null {
  if (!pitch.hasReview || pitch.challengerTeamId === null || pitch.isOverturned === null) {
    return null;
  }
  if (pitch.challengerPlayerId === null) return null;

  const playerDeltas: PlayerBucketDelta[] = [];
  const teamDeltas: TeamBucketDelta[] = [];
  const playerAppearanceIds: number[] = [pitch.challengerPlayerId];

  addPlayerDelta(playerDeltas, pitch.challengerPlayerId, { challengesUsed: 1 });
  addTeamDelta(teamDeltas, pitch.challengerTeamId, { challengesUsed: 1 });

  if (pitch.isOverturned === true) {
    addPlayerDelta(playerDeltas, pitch.challengerPlayerId, { challengesOverturned: 1 });
    addTeamDelta(teamDeltas, pitch.challengerTeamId, { challengesOverturned: 1 });

    if (pitch.gainedRe > 0) {
      if (isBattingSideChallenge(pitch.challengerTeamId, game, pitch.halfInning)) {
        addPlayerDelta(playerDeltas, pitch.batterId, { battingGainedRe: pitch.gainedRe });
        addTeamDelta(teamDeltas, battingTeamId(game, pitch.halfInning), {
          battingGainedRe: pitch.gainedRe,
        });
        playerAppearanceIds.push(pitch.batterId);
      } else {
        addPlayerDelta(playerDeltas, pitch.challengerPlayerId, {
          fieldingGainedRe: pitch.gainedRe,
        });
        addTeamDelta(teamDeltas, pitch.challengerTeamId, { fieldingGainedRe: pitch.gainedRe });
      }
    }
  }

  return { playerDeltas, teamDeltas, playerAppearanceIds };
}

/** Build delta for a postgame audit row (missed opportunities and bad challenges). */
export function buildPostgameAuditDelta(
  game: RankingsGameContext,
  audit: PostgameAuditContext
): RankingsEventDelta | null {
  const playerDeltas: PlayerBucketDelta[] = [];
  const teamDeltas: TeamBucketDelta[] = [];
  const playerAppearanceIds: number[] = [audit.batterId];

  if (audit.missedChallenge) {
    if (audit.challengeSide === "fielding") {
      if (audit.catcherId != null) {
        addPlayerDelta(playerDeltas, audit.catcherId, {
          fieldingMissedCount: 1,
          fieldingMissedValue: audit.runExpectancySwing,
        });
        playerAppearanceIds.push(audit.catcherId);
      }
      addTeamDelta(teamDeltas, fieldingTeamId(game, audit.halfInning), {
        fieldingMissedCount: 1,
        fieldingMissedValue: audit.runExpectancySwing,
      });
    } else {
      addPlayerDelta(playerDeltas, audit.batterId, {
        battingMissedCount: 1,
        battingMissedValue: audit.runExpectancySwing,
        missedOpportunities: 1,
      });
      addTeamDelta(teamDeltas, battingTeamId(game, audit.halfInning), {
        battingMissedCount: 1,
        battingMissedValue: audit.runExpectancySwing,
      });
    }
  }

  if (audit.badChallengeAllowed && audit.challengerPlayerId !== null) {
    addPlayerDelta(playerDeltas, audit.challengerPlayerId, { badChallenges: 1 });
    playerAppearanceIds.push(audit.challengerPlayerId);
    if (audit.challengerTeamId !== null) {
      addTeamDelta(teamDeltas, audit.challengerTeamId, { badChallenges: 1 });
    }
  }

  if (playerDeltas.length === 0 && teamDeltas.length === 0) {
    return null;
  }

  return { playerDeltas, teamDeltas, playerAppearanceIds };
}

/** Negate a delta for retention purge reversal. */
export function negateRankingsEventDelta(delta: RankingsEventDelta): RankingsEventDelta {
  const negate = (n: number | undefined): number | undefined =>
    n === undefined ? undefined : -n;

  return {
    playerAppearanceIds: delta.playerAppearanceIds,
    playerDeltas: delta.playerDeltas.map((d) => ({
      playerId: d.playerId,
      challengesUsed: negate(d.challengesUsed),
      challengesOverturned: negate(d.challengesOverturned),
      missedOpportunities: negate(d.missedOpportunities),
      totalMissedValue: negate(d.totalMissedValue),
      battingMissedCount: negate(d.battingMissedCount),
      battingMissedValue: negate(d.battingMissedValue),
      fieldingMissedCount: negate(d.fieldingMissedCount),
      fieldingMissedValue: negate(d.fieldingMissedValue),
      battingGainedRe: negate(d.battingGainedRe),
      fieldingGainedRe: negate(d.fieldingGainedRe),
      badChallenges: negate(d.badChallenges),
    })),
    teamDeltas: delta.teamDeltas.map((d) => ({
      teamId: d.teamId,
      challengesUsed: negate(d.challengesUsed),
      challengesOverturned: negate(d.challengesOverturned),
      battingMissedCount: negate(d.battingMissedCount),
      battingMissedValue: negate(d.battingMissedValue),
      fieldingMissedCount: negate(d.fieldingMissedCount),
      fieldingMissedValue: negate(d.fieldingMissedValue),
      battingGainedRe: negate(d.battingGainedRe),
      fieldingGainedRe: negate(d.fieldingGainedRe),
      badChallenges: negate(d.badChallenges),
    })),
  };
}
