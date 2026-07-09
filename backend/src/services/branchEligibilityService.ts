import {
  fetchLiveFeed,
  assessBranchRosterFromFeed,
  type BranchRosterAssessment,
} from "@abs/data-pipeline";
import type { BranchEligibilityDto } from "../branch/branchTypes";

export class BranchNotEligibleError extends Error {
  constructor(
    message: string,
    public readonly assessment: BranchRosterAssessment
  ) {
    super(message);
    this.name = "BranchNotEligibleError";
  }
}

export async function fetchFeedForBranch(gamePk: number) {
  try {
    return await fetchLiveFeed(gamePk);
  } catch {
    return null;
  }
}

export function toEligibilityDto(
  gamePk: number,
  assessment: BranchRosterAssessment
): BranchEligibilityDto {
  return {
    gamePk,
    eligible: assessment.eligible,
    reason: assessment.reason,
    lineupIncomplete: assessment.lineupIncomplete,
    warmupStarted: assessment.warmupStarted,
    roster: assessment.roster,
  };
}

export async function getBranchEligibility(
  gamePk: number
): Promise<BranchEligibilityDto> {
  const feed = await fetchFeedForBranch(gamePk);
  if (!feed) {
    return {
      gamePk,
      eligible: false,
      reason: "Could not load MLB game feed.",
      lineupIncomplete: true,
      warmupStarted: false,
      roster: {
        home: { lineup: 0, bench: 0, bullpen: 0, batters: 0, pitchers: 0 },
        away: { lineup: 0, bench: 0, bullpen: 0, batters: 0, pitchers: 0 },
      },
    };
  }
  return toEligibilityDto(gamePk, assessBranchRosterFromFeed(feed));
}

export async function assertBranchEligible(
  gamePk: number
): Promise<BranchRosterAssessment> {
  const feed = await fetchFeedForBranch(gamePk);
  if (!feed) {
    throw new BranchNotEligibleError("Game feed unavailable.", {
      eligible: false,
      reason: "Could not load MLB game feed.",
      lineupIncomplete: true,
      warmupStarted: false,
      roster: {
        home: { lineup: 0, bench: 0, bullpen: 0, batters: 0, pitchers: 0 },
        away: { lineup: 0, bench: 0, bullpen: 0, batters: 0, pitchers: 0 },
      },
    });
  }
  const assessment = assessBranchRosterFromFeed(feed);
  if (!assessment.eligible) {
    throw new BranchNotEligibleError(assessment.reason, assessment);
  }
  return assessment;
}
