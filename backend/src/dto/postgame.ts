import type { PostgameChallengeAudit } from "@prisma/client";

export type PostgameAuditStatus = "pending" | "ready" | "unavailable";

export type PostgameBattingSide = "home" | "away";
export type PostgameChallengeSide = "batting" | "fielding";

export interface PostgameAuditItemDto {
  atBatIndex: number;
  pitchNumber: number;
  inning: number;
  halfInning: string;
  /** Team at bat for this pitch (Top → away, Bot → home). */
  battingSide: PostgameBattingSide;
  /** Which side should have challenged on this pitch. */
  challengeSide: PostgameChallengeSide;
  count: string;
  batterId: number;
  pitcherId: number;

  liveRecommendation: "AUTO_ALLOW" | "ALLOW" | "WARN" | "DENY" | "FIELDING" | "NONE";
  expectedValue: number;
  challengeAvailable: boolean;

  originalCall: "ball" | "strike" | "unknown";
  zoneResult: "ball" | "strike" | "unknown";
  plateX: number | null;
  plateZ: number | null;

  callWasProbablyWrong: boolean;
  shouldHaveChallenged: boolean;
  missedChallenge: boolean;
  badChallengeAllowed: boolean;

  notes: string[];
}

export interface PostgameAuditTeamSummaryDto {
  teamId: number;
  side: PostgameBattingSide;
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  topMissed: PostgameAuditItemDto[];
}

export interface PostgameAuditSummaryDto {
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  shouldHaveChallengedCount: number;
  topMissed: PostgameAuditItemDto[];
  byTeam: {
    away: PostgameAuditTeamSummaryDto;
    home: PostgameAuditTeamSummaryDto;
  };
}

export interface PostgameAuditResponseDto {
  gamePk: number;
  status: PostgameAuditStatus;
  enrichedAt: string | null;
  /** @deprecated Always null — audit runs shortly after Final using MLB live feed data. */
  pollEarliestAt: string | null;
  summary: PostgameAuditSummaryDto;
  missedChallenges: PostgameAuditItemDto[];
  allAudits: PostgameAuditItemDto[];
}

export function battingSideFromHalfInning(halfInning: string): PostgameBattingSide {
  return halfInning.toLowerCase() === "top" ? "away" : "home";
}

export function fieldingSideFromHalfInning(halfInning: string): PostgameBattingSide {
  return battingSideFromHalfInning(halfInning) === "away" ? "home" : "away";
}

export function challengingTeamSide(
  halfInning: string,
  challengeSide: PostgameChallengeSide
): PostgameBattingSide {
  return challengeSide === "fielding"
    ? fieldingSideFromHalfInning(halfInning)
    : battingSideFromHalfInning(halfInning);
}

export function toPostgameAuditItemDto(
  audit: PostgameChallengeAudit
): PostgameAuditItemDto {
  const notes = Array.isArray(audit.notesJson)
    ? (audit.notesJson as string[])
    : [];

  return {
    atBatIndex: audit.atBatIndex,
    pitchNumber: audit.pitchNumber,
    inning: audit.inning,
    halfInning: audit.halfInning === "top" ? "Top" : "Bot",
    battingSide: battingSideFromHalfInning(audit.halfInning),
    challengeSide: (audit.challengeSide === "fielding" ? "fielding" : "batting") as PostgameChallengeSide,
    count: `${audit.balls}-${audit.strikes}`,
    batterId: audit.batterId,
    pitcherId: audit.pitcherId,
    liveRecommendation: audit.liveRecommendation as PostgameAuditItemDto["liveRecommendation"],
    expectedValue: audit.runExpectancySwing,
    challengeAvailable: audit.challengeAvailable,
    originalCall: audit.originalCall as PostgameAuditItemDto["originalCall"],
    zoneResult: audit.zoneResult as PostgameAuditItemDto["zoneResult"],
    plateX: audit.plateX,
    plateZ: audit.plateZ,
    callWasProbablyWrong: audit.callWasProbablyWrong,
    shouldHaveChallenged: audit.shouldHaveChallenged,
    missedChallenge: audit.missedChallenge,
    badChallengeAllowed: audit.badChallengeAllowed,
    notes,
  };
}

function buildTeamSummary(
  side: PostgameBattingSide,
  teamId: number,
  missedChallenges: PostgameAuditItemDto[],
  allAudits: PostgameAuditItemDto[]
): PostgameAuditTeamSummaryDto {
  const teamMissed = missedChallenges.filter(
    (a) => challengingTeamSide(a.halfInning, a.challengeSide) === side
  );
  return {
    teamId,
    side,
    totalMissedValue: teamMissed.reduce((sum, a) => sum + a.expectedValue, 0),
    missedChallengeCount: teamMissed.length,
    badChallengeCount: allAudits.filter(
      (a) =>
        a.badChallengeAllowed &&
        challengingTeamSide(a.halfInning, a.challengeSide) === side
    ).length,
    topMissed: teamMissed.slice(0, 3),
  };
}

export function toPostgameAuditResponseDto(
  gamePk: number,
  status: PostgameAuditStatus,
  enrichedAt: Date | null,
  audits: PostgameChallengeAudit[],
  teamIds?: { homeTeamId: number; awayTeamId: number }
): PostgameAuditResponseDto {
  const allAudits = audits.map(toPostgameAuditItemDto);
  const missedChallenges = allAudits
    .filter((a) => a.missedChallenge)
    .sort((a, b) => b.expectedValue - a.expectedValue);

  const totalMissedValue = missedChallenges.reduce(
    (sum, a) => sum + a.expectedValue,
    0
  );

  const homeTeamId = teamIds?.homeTeamId ?? 0;
  const awayTeamId = teamIds?.awayTeamId ?? 0;

  return {
    gamePk,
    status,
    enrichedAt: enrichedAt?.toISOString() ?? null,
    pollEarliestAt: null,
    summary: {
      totalMissedValue,
      missedChallengeCount: missedChallenges.length,
      badChallengeCount: allAudits.filter((a) => a.badChallengeAllowed).length,
      shouldHaveChallengedCount: allAudits.filter((a) => a.shouldHaveChallenged).length,
      topMissed: missedChallenges.slice(0, 3),
      byTeam: {
        away: buildTeamSummary("away", awayTeamId, missedChallenges, allAudits),
        home: buildTeamSummary("home", homeTeamId, missedChallenges, allAudits),
      },
    },
    missedChallenges,
    allAudits,
  };
}
