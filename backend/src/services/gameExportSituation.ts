import type { BranchCheckpoint, BranchSituation } from "../branch/branchTypes";

export interface SnapshotSituationSeed {
  atBatIndex: number;
  inning: number;
  halfInning: string;
  outs: number;
  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;
  runnerFirstId?: number | null;
  runnerSecondId?: number | null;
  runnerThirdId?: number | null;
  homeScore: number;
  awayScore: number;
  batterId: number;
  pitcherId: number;
  battingTeamId: number;
  fieldingTeamId: number;
}

export function snapshotToSituation(
  snap: SnapshotSituationSeed,
  homeChallenges: number,
  awayChallenges: number,
  liveCount?: { balls: number; strikes: number }
): BranchSituation {
  const half = snap.halfInning === "bottom" ? "bottom" : "top";
  return {
    inning: snap.inning,
    halfInning: half,
    balls: liveCount?.balls ?? 0,
    strikes: liveCount?.strikes ?? 0,
    outs: Math.min(Math.max(0, snap.outs), 2),
    runners: {
      first: snap.runnerOnFirst ? snap.runnerFirstId ?? undefined : undefined,
      second: snap.runnerOnSecond ? snap.runnerSecondId ?? undefined : undefined,
      third: snap.runnerOnThird ? snap.runnerThirdId ?? undefined : undefined,
    },
    homeScore: snap.homeScore,
    awayScore: snap.awayScore,
    batterId: snap.batterId,
    pitcherId: snap.pitcherId,
    battingTeamId: snap.battingTeamId,
    fieldingTeamId: snap.fieldingTeamId,
    homeChallengesRemaining: homeChallenges,
    awayChallengesRemaining: awayChallenges,
  };
}

export type ForkSituationSource = "checkpoint" | "live" | "snapshot";

export interface ResolvedForkSituation {
  situation: BranchSituation | null;
  checkpoint: BranchCheckpoint;
  source: ForkSituationSource | "none";
}

/**
 * Choose the fork point. Explicit historical checkpoints still use a stored
 * snapshot; otherwise prefer the live feed's current play over the latest
 * ingested at-bat (which can lag by one or more plate appearances).
 */
export function resolveForkSituation(input: {
  checkpointAtBatIndex?: number;
  snapshots: SnapshotSituationSeed[];
  liveSituation: BranchSituation | null;
  liveAtBatIndex?: number;
  homeChallenges: number;
  awayChallenges: number;
}): ResolvedForkSituation {
  const { snapshots, liveSituation, liveAtBatIndex, homeChallenges, awayChallenges } =
    input;

  if (input.checkpointAtBatIndex != null) {
    const seed =
      snapshots.find((s) => s.atBatIndex === input.checkpointAtBatIndex) ??
      snapshots.at(-1);
    if (seed) {
      return {
        situation: snapshotToSituation(seed, homeChallenges, awayChallenges),
        checkpoint: {
          atBatIndex: input.checkpointAtBatIndex,
          label: `At-bat ${input.checkpointAtBatIndex}`,
        },
        source: "checkpoint",
      };
    }
  }

  if (liveSituation) {
    return {
      situation: liveSituation,
      checkpoint: {
        atBatIndex: liveAtBatIndex,
        label: liveAtBatIndex != null ? "Current play" : "Live game state",
      },
      source: "live",
    };
  }

  const latest = snapshots.at(-1);
  if (latest) {
    return {
      situation: snapshotToSituation(latest, homeChallenges, awayChallenges),
      checkpoint: {
        atBatIndex: latest.atBatIndex,
        label: "Latest snapshot",
      },
      source: "snapshot",
    };
  }

  return {
    situation: null,
    checkpoint: { label: "Pregame / warmup" },
    source: "none",
  };
}
