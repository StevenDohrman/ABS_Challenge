import {
  buildPitchReviewDelta,
  buildPostgameAuditDelta,
  type RankingsGameContext,
} from "../services/rankingsDelta";

const game: RankingsGameContext = {
  gamePk: 1,
  gameDate: "2026-06-20",
  homeTeamId: 111,
  awayTeamId: 147,
};

describe("buildPitchReviewDelta", () => {
  it("credits batter batting gained RE on successful batting-side overturn", () => {
    const delta = buildPitchReviewDelta(game, {
      pitchEventId: 10,
      gamePk: 1,
      hasReview: true,
      isOverturned: true,
      challengerTeamId: 111,
      challengerPlayerId: 500,
      batterId: 600,
      halfInning: "bottom",
      gainedRe: 0.22,
    });

    expect(delta?.playerDeltas.find((d) => d.playerId === 600)?.battingGainedRe).toBeCloseTo(0.22);
    expect(delta?.playerDeltas.find((d) => d.playerId === 500)?.fieldingGainedRe).toBeUndefined();
  });

  it("credits challenger fielding gained RE on successful fielding-side overturn", () => {
    const delta = buildPitchReviewDelta(game, {
      pitchEventId: 10,
      gamePk: 1,
      hasReview: true,
      isOverturned: true,
      challengerTeamId: 147,
      challengerPlayerId: 500,
      batterId: 600,
      halfInning: "bottom",
      gainedRe: 0.25,
    });

    expect(delta?.playerDeltas.find((d) => d.playerId === 500)?.fieldingGainedRe).toBeCloseTo(0.25);
  });

  it("returns null when review is still in progress", () => {
    expect(
      buildPitchReviewDelta(game, {
        pitchEventId: 10,
        gamePk: 1,
        hasReview: true,
        isOverturned: null,
        challengerTeamId: 111,
        challengerPlayerId: 500,
        batterId: 600,
        halfInning: "bottom",
        gainedRe: 0,
      })
    ).toBeNull();
  });
});

describe("buildPostgameAuditDelta", () => {
  it("attributes missed opportunities to batter and batting team", () => {
    const delta = buildPostgameAuditDelta(game, {
      pitchEventId: 20,
      batterId: 600,
      halfInning: "top",
      missedChallenge: true,
      badChallengeAllowed: false,
      runExpectancySwing: 0.15,
      challengerPlayerId: null,
      challengerTeamId: null,
    });

    expect(delta?.playerDeltas[0]?.missedOpportunities).toBe(1);
    expect(delta?.teamDeltas.find((d) => d.teamId === 147)?.battingMissedCount).toBe(1);
  });

  it("counts bad challenges for challenger", () => {
    const delta = buildPostgameAuditDelta(game, {
      pitchEventId: 11,
      batterId: 601,
      halfInning: "top",
      missedChallenge: false,
      badChallengeAllowed: true,
      runExpectancySwing: 0,
      challengerPlayerId: 501,
      challengerTeamId: 147,
    });

    expect(delta?.playerDeltas.find((d) => d.playerId === 501)?.badChallenges).toBe(1);
  });
});
