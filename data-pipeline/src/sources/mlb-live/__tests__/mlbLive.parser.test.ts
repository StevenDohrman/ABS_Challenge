import {
  parsePitchEvents,
  parseGameSnapshot,
  parseAtBatSnapshot,
  pitchKey,
} from "../mlbLive.parser";
import {
  buildLiveFeedResponse,
  buildPlay,
  buildPlayEvent,
  buildBallEvent,
  buildLinescore,
} from "./fixtures/mlbLiveFeed.fixture";
import { MlbLiveFeedResponse, MlbLiveData } from "../mlbLive.api.types";
import { MlbLivePitchEvent } from "../mlbLive.types";

const FETCHED_AT = "2026-06-17T04:39:17.000Z";

// ---------------------------------------------------------------------------
// parsePitchEvents
// ---------------------------------------------------------------------------

describe("parsePitchEvents", () => {
  it("returns one event for the single pitch in the default fixture", () => {
    const feed = buildLiveFeedResponse();
    expect(parsePitchEvents(feed, FETCHED_AT)).toHaveLength(1);
  });

  it("maps gamePk, atBatIndex, and pitchNumber", () => {
    const feed = buildLiveFeedResponse({ gamePk: 824991 });
    const [event] = parsePitchEvents(feed, FETCHED_AT);

    expect(event.gamePk).toBe(824991);
    expect(event.atBatIndex).toBe(0);
    expect(event.pitchNumber).toBe(1);
  });

  it("maps batter and pitcher IDs from the play matchup", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect(event.batterId).toBe(682998);
    expect(event.pitcherId).toBe(656731);
  });

  it("maps inning and halfInning", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect(event.inning).toBe(9);
    expect(event.halfInning).toBe("bottom");
  });

  it("maps callCode and callDescription", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect(event.callCode).toBe("C");
    expect(event.callDescription).toBe("Called Strike");
  });

  it("sets ballsBefore and strikesBefore to 0 for the first pitch of an at-bat", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect(event.ballsBefore).toBe(0);
    expect(event.strikesBefore).toBe(0);
  });

  it("sets post-pitch balls and strikes from the event count", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    // Default fixture: called strike → count becomes 0-1
    expect(event.balls).toBe(0);
    expect(event.strikes).toBe(1);
  });

  it("carries ballsBefore/strikesBefore forward from the previous pitch", () => {
    // Two-pitch sequence: ball (0-0 → 1-0), then called strike (1-0 → 1-1)
    const play = buildPlay({
      playEvents: [
        buildBallEvent({
          pitchNumber: 1,
          count: { balls: 1, strikes: 0, outs: 0 },
        }),
        buildPlayEvent({
          pitchNumber: 2,
          count: { balls: 1, strikes: 1, outs: 0 },
        }),
      ],
    });
    const liveData: MlbLiveData = {
      plays: { allPlays: [play], currentPlay: play },
      linescore: buildLinescore(),
    };
    const feed = buildLiveFeedResponse({ liveData });

    const events = parsePitchEvents(feed, FETCHED_AT);
    expect(events).toHaveLength(2);

    expect(events[0].ballsBefore).toBe(0);
    expect(events[0].strikesBefore).toBe(0);
    expect(events[0].balls).toBe(1);
    expect(events[0].strikes).toBe(0);

    expect(events[1].ballsBefore).toBe(1);
    expect(events[1].strikesBefore).toBe(0);
    expect(events[1].balls).toBe(1);
    expect(events[1].strikes).toBe(1);
  });

  it("skips non-pitch play events (actions, pickoffs)", () => {
    const play = buildPlay({
      playEvents: [
        { ...buildPlayEvent(), isPitch: false, type: "action" as const },
        buildPlayEvent({ pitchNumber: 1 }),
      ],
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play], currentPlay: play },
        linescore: buildLinescore(),
      },
    });

    expect(parsePitchEvents(feed, FETCHED_AT)).toHaveLength(1);
  });

  it("accumulates events across multiple plays", () => {
    const play0 = buildPlay({
      about: {
        atBatIndex: 0,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: true,
      },
      playEvents: [buildPlayEvent({ pitchNumber: 1 }), buildPlayEvent({ pitchNumber: 2 })],
    });
    const play1 = buildPlay({
      about: {
        atBatIndex: 1,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:35:00Z",
        isComplete: false,
      },
      playEvents: [buildPlayEvent({ pitchNumber: 1 })],
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play0, play1], currentPlay: play1 },
        linescore: buildLinescore(),
      },
    });

    expect(parsePitchEvents(feed, FETCHED_AT)).toHaveLength(3);
  });

  it("sets raw to the original MlbPlayEvent", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect((event.raw as { isPitch: boolean }).isPitch).toBe(true);
  });

  it("sets fetchedAt to the provided timestamp", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);

    expect(event.fetchedAt).toBe(FETCHED_AT);
  });

  it("returns empty array when allPlays is empty", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [], currentPlay: undefined },
        linescore: buildLinescore(),
      },
    });

    expect(parsePitchEvents(feed, FETCHED_AT)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseGameSnapshot
// ---------------------------------------------------------------------------

describe("parseGameSnapshot", () => {
  it("maps inning and halfInning from linescore", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.inning).toBe(9);
    expect(snapshot.halfInning).toBe("bottom");
  });

  it("maps outs, balls, and strikes from linescore", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.outs).toBe(2);
    expect(snapshot.balls).toBe(0);
    expect(snapshot.strikes).toBe(2);
  });

  it("maps runner occupancy as booleans", () => {
    const linescore = buildLinescore({
      offense: {
        batter: { id: 682998, fullName: "Jacob Wilson" },
        first: { id: 111111 },
        third: { id: 333333 },
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore,
      },
    });
    const snapshot = parseGameSnapshot(feed, FETCHED_AT);

    expect(snapshot.runnerOnFirst).toBe(true);
    expect(snapshot.runnerOnSecond).toBe(false);
    expect(snapshot.runnerOnThird).toBe(true);
  });

  it("reports no runners when offense is empty", () => {
    const linescore = buildLinescore({ offense: {} });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore,
      },
    });
    const snapshot = parseGameSnapshot(feed, FETCHED_AT);

    expect(snapshot.runnerOnFirst).toBe(false);
    expect(snapshot.runnerOnSecond).toBe(false);
    expect(snapshot.runnerOnThird).toBe(false);
  });

  it("maps home and away scores", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.homeScore).toBe(5);
    expect(snapshot.awayScore).toBe(6);
  });

  it("maps home and away team IDs from gameData.teams", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.homeTeamId).toBe(133);
    expect(snapshot.awayTeamId).toBe(134);
  });

  it("maps detailedState", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.detailedState).toBe("In Progress");
  });

  it("maps batterId from linescore offense", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.batterId).toBe(682998);
  });

  it("sets fetchedAt to the provided timestamp", () => {
    const snapshot = parseGameSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot.fetchedAt).toBe(FETCHED_AT);
  });
});

// ---------------------------------------------------------------------------
// parseAtBatSnapshot
// ---------------------------------------------------------------------------

describe("parseAtBatSnapshot", () => {
  it("returns null when currentPlay is absent", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [], currentPlay: undefined },
        linescore: buildLinescore(),
      },
    });

    expect(parseAtBatSnapshot(feed, FETCHED_AT)).toBeNull();
  });

  it("maps atBatIndex from currentPlay", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.atBatIndex).toBe(0);
  });

  it("maps batter and pitcher IDs from the current play matchup", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.batterId).toBe(682998);
    expect(snapshot?.pitcherId).toBe(656731);
  });

  it("maps inning, halfInning, and outs", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.inning).toBe(9);
    expect(snapshot?.halfInning).toBe("bottom");
    expect(snapshot?.outs).toBe(2);
  });

  it("maps runner occupancy from linescore offense", () => {
    const linescore = buildLinescore({
      offense: {
        batter: { id: 682998, fullName: "Jacob Wilson" },
        second: { id: 222222 },
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore,
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    expect(snapshot?.runnerOnFirst).toBe(false);
    expect(snapshot?.runnerOnSecond).toBe(true);
    expect(snapshot?.runnerOnThird).toBe(false);
  });

  it("infers battingTeamId and fieldingTeamId from halfInning when linescore lacks them", () => {
    // Fixture: currentPlay.halfInning = "bottom" → home team bats
    // Home = Oakland (133), Away = Pittsburgh (134)
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.battingTeamId).toBe(133);
    expect(snapshot?.fieldingTeamId).toBe(134);
  });

  it("infers away team as batter for top-half at-bats", () => {
    const play = buildPlay({
      about: {
        atBatIndex: 0,
        halfInning: "top",
        isTopInning: true,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: false,
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play], currentPlay: play },
        linescore: buildLinescore({ inningHalf: "Top", isTopInning: true }),
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    // top half → away team bats (Pittsburgh = 134), home team fields (Oakland = 133)
    expect(snapshot?.battingTeamId).toBe(134);
    expect(snapshot?.fieldingTeamId).toBe(133);
  });

  it("maps home and away scores", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.homeScore).toBe(5);
    expect(snapshot?.awayScore).toBe(6);
  });

  it("sets fetchedAt to the provided timestamp", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.fetchedAt).toBe(FETCHED_AT);
  });
});

// ---------------------------------------------------------------------------
// pitchKey
// ---------------------------------------------------------------------------

describe("pitchKey", () => {
  const base: MlbLivePitchEvent = {
    gamePk: 824991,
    atBatIndex: 3,
    pitchNumber: 2,
    inning: 5,
    halfInning: "top",
    ballsBefore: 1,
    strikesBefore: 0,
    balls: 2,
    strikes: 0,
    outs: 1,
    batterId: 1,
    pitcherId: 2,
    raw: {},
    fetchedAt: FETCHED_AT,
  };

  it("returns playId when present", () => {
    expect(pitchKey({ ...base, playId: "abc-xyz-001" })).toBe("abc-xyz-001");
  });

  it("returns a composite key when playId is absent", () => {
    expect(pitchKey(base)).toBe("824991-3-2");
  });

  it("produces distinct keys for different pitches in the same at-bat", () => {
    const key1 = pitchKey({ ...base, pitchNumber: 1 });
    const key2 = pitchKey({ ...base, pitchNumber: 2 });

    expect(key1).not.toBe(key2);
  });
});
