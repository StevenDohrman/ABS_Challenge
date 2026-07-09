import { decideChallenge } from "@abs/engine";
import type { MlbAtBatSnapshot } from "@abs/data-pipeline";
import { ALL_COUNT_STATES } from "../db/constants";
import {
  buildAtBatChallengeContext,
  buildChallengeInputForCount,
} from "./challengeInputBuilder";
import type { BranchDocument } from "../branch/branchTypes";
import type { AtBatRecommendationGridResponseDto } from "../dto/recommendation";
import { toAtBatGridFromDecisions } from "../dto/recommendation";

function teamBranch(doc: BranchDocument, teamId: number) {
  if (teamId === doc.schedule.homeTeamId) return doc.teams.home;
  if (teamId === doc.schedule.awayTeamId) return doc.teams.away;
  return doc.teams.home;
}

function branchToAtBatSnapshot(doc: BranchDocument): MlbAtBatSnapshot {
  const sit = doc.situation;
  const battingTeam = teamBranch(doc, sit.battingTeamId);
  const fieldingTeam = teamBranch(doc, sit.fieldingTeamId);

  return {
    gamePk: doc.parentGamePk,
    atBatIndex: doc.checkpoint.atBatIndex ?? 0,
    batterId: sit.batterId,
    pitcherId: sit.pitcherId,
    inning: sit.inning,
    halfInning: sit.halfInning,
    outs: sit.outs,
    runnerOnFirst: sit.runners.first != null,
    runnerOnSecond: sit.runners.second != null,
    runnerOnThird: sit.runners.third != null,
    runnerIds: sit.runners,
    homeScore: sit.homeScore,
    awayScore: sit.awayScore,
    battingTeamId: sit.battingTeamId,
    fieldingTeamId: sit.fieldingTeamId,
    defense: fieldingTeam.defense,
    battingOrder: battingTeam.battingOrder,
    fetchedAt: new Date().toISOString(),
  };
}

function challengesForBattingTeam(doc: BranchDocument): number {
  const sit = doc.situation;
  return sit.battingTeamId === doc.schedule.homeTeamId
    ? sit.homeChallengesRemaining
    : sit.awayChallengesRemaining;
}

/**
 * Run the challenge engine for all 12 count states from branch situation.
 * Read-only — results are returned to the client cache, never persisted.
 */
export async function computeBranchPreviewGrid(
  doc: BranchDocument
): Promise<AtBatRecommendationGridResponseDto> {
  const snapshot = branchToAtBatSnapshot(doc);
  const battingTeam = teamBranch(doc, snapshot.battingTeamId);

  const ctx = await buildAtBatChallengeContext(snapshot, {
    challengesRemainingOverride: challengesForBattingTeam(doc),
    battingOrderOverride: battingTeam.battingOrder,
    defenseOverride: teamBranch(doc, snapshot.fieldingTeamId).defense,
  });

  const decisions = ALL_COUNT_STATES.map(([balls, strikes]) => {
    const input = buildChallengeInputForCount(snapshot, balls, strikes, ctx);
    const decision = decideChallenge(input);
    return {
      balls,
      strikes,
      recommendation: decision.recommendation,
      minimumConfidenceRequired: decision.minimumPlayerConfidenceRequired,
      expectedValue: decision.expectedValueOfChallenge,
      score: decision.score,
      challengeAvailable: ctx.challengeAvailable,
    };
  });

  const halfLabel = snapshot.halfInning === "top" ? "Top" : "Bot";
  return toAtBatGridFromDecisions(
    doc.parentGamePk,
    snapshot.atBatIndex,
    decisions,
    snapshot.inning,
    halfLabel
  );
}
