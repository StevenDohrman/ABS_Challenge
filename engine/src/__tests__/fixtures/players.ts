import { PlayerChallengeContext } from "../../domain/playerContext.types";

export const disciplinedPlayer: PlayerChallengeContext = {
  playerId: 100,
  battingHand: "L",
  obp: 0.390,
  ops: 0.920,
  walkRate: 0.13,
  strikeoutRate: 0.16,
  chasePercent: 0.17,
  whiffPercent: 0.19,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

export const averagePlayer: PlayerChallengeContext = {
  playerId: 101,
  battingHand: "R",
  obp: 0.320,
  ops: 0.750,
  walkRate: 0.085,
  strikeoutRate: 0.225,
  chasePercent: 0.30,
  whiffPercent: 0.25,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};

export const aggressivePlayer: PlayerChallengeContext = {
  playerId: 102,
  battingHand: "R",
  obp: 0.290,
  ops: 0.700,
  walkRate: 0.045,
  strikeoutRate: 0.32,
  chasePercent: 0.45,
  whiffPercent: 0.38,
  historicalChallengeAttempts: 0,
  historicalChallengeSuccessRate: null,
  sprayProfile: null,
  fielderOaa: null,
};
