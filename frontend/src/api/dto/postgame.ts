import type { RecommendationLabel } from "./recommendation";

export type PostgameAuditStatus = "pending" | "ready" | "unavailable";

export type PostgameBattingSide = "home" | "away";

export interface PostgameAuditItem {
  atBatIndex: number;
  pitchNumber: number;
  inning: number;
  halfInning: string;
  battingSide: PostgameBattingSide;
  count: string;
  batterId: number;
  pitcherId: number;

  liveRecommendation: RecommendationLabel;
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

export interface PostgameAuditTeamSummary {
  teamId: number;
  side: PostgameBattingSide;
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  topMissed: PostgameAuditItem[];
}

export interface PostgameAuditSummary {
  totalMissedValue: number;
  missedChallengeCount: number;
  badChallengeCount: number;
  shouldHaveChallengedCount: number;
  topMissed: PostgameAuditItem[];
  byTeam: {
    away: PostgameAuditTeamSummary;
    home: PostgameAuditTeamSummary;
  };
}

export interface PostgameAuditResponse {
  gamePk: number;
  status: PostgameAuditStatus;
  enrichedAt: string | null;
  pollEarliestAt: string | null;
  summary: PostgameAuditSummary;
  missedChallenges: PostgameAuditItem[];
  allAudits: PostgameAuditItem[];
}
