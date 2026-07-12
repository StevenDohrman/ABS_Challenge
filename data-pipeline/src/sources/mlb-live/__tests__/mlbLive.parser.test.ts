import {
  parsePitchEvents,
  parseGameSnapshot,
  parseAtBatSnapshot,
  parseHistoricalAtBatSnapshots,
  parseAllAtBatSnapshots,
  parseGameLineups,
  pitchKey,
} from "../mlbLive.parser";
import {
  buildLiveFeedResponse,
  buildPlay,
  buildPlayEvent,
  buildBallEvent,
  buildLinescore,
  buildCount,
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

  it("extracts pitch location from pitchData", () => {
    const play = buildPlay({
      playEvents: [
        buildPlayEvent({
          pitchData: {
            strikeZoneTop: 3.42,
            strikeZoneBottom: 1.62,
            zone: 13,
            coordinates: { pX: 0.95, pZ: 2.08 },
          },
        }),
      ],
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play], currentPlay: play },
        linescore: buildLinescore(),
      },
    });

    const [event] = parsePitchEvents(feed, FETCHED_AT);
    expect(event.plateX).toBe(0.95);
    expect(event.plateZ).toBe(2.08);
    expect(event.strikeZoneTop).toBe(3.42);
    expect(event.strikeZoneBottom).toBe(1.62);
    expect(event.mlbZone).toBe(13);
  });

  it("omits location fields when pitchData is absent", () => {
    const [event] = parsePitchEvents(buildLiveFeedResponse(), FETCHED_AT);
    expect(event.plateX).toBeUndefined();
    expect(event.plateZ).toBeUndefined();
    expect(event.strikeZoneTop).toBeUndefined();
    expect(event.strikeZoneBottom).toBeUndefined();
    expect(event.mlbZone).toBeUndefined();
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

  it("maps batter and pitcher handedness from matchup", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.batterHand).toBe("R");
    expect(snapshot?.pitcherHand).toBe("L");
  });

  it("maps inning, halfInning, and outs at the start of the at-bat", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.inning).toBe(9);
    expect(snapshot?.halfInning).toBe("bottom");
    // First pitch in the default fixture has outs=0 — the state when this at-bat began.
    expect(snapshot?.outs).toBe(0);
  });

  it("maps runner occupancy from the previous play's postOn fields", () => {
    const priorPlay = buildPlay({
      about: {
        atBatIndex: 4,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:29:00Z",
        isComplete: true,
      },
      matchup: {
        ...buildPlay().matchup,
        postOnSecond: { id: 222222, fullName: "Runner Two", link: "/api/v1/people/222222" },
      },
    });
    const currentPlay = buildPlay({
      about: {
        atBatIndex: 5,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: false,
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [priorPlay, currentPlay], currentPlay },
        linescore: buildLinescore(),
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

  it("maps home and away scores at at-bat start from the previous play result", () => {
    const priorPlay = buildPlay({
      about: {
        atBatIndex: 4,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:29:00Z",
        isComplete: true,
      },
      result: {
        type: "atBat",
        event: "Groundout",
        eventType: "field_out",
        description: "Groundout.",
        homeScore: 5,
        awayScore: 6,
      },
    });
    const currentPlay = buildPlay({
      about: {
        atBatIndex: 5,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: false,
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [priorPlay, currentPlay], currentPlay },
        linescore: buildLinescore(),
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    expect(snapshot?.homeScore).toBe(5);
    expect(snapshot?.awayScore).toBe(6);
  });

  it("sets fetchedAt to the provided timestamp", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.fetchedAt).toBe(FETCHED_AT);
  });

  it("caps outs at 2 — the feed may briefly report 3 after the third out", () => {
    const play = buildPlay({
      about: {
        atBatIndex: 2,
        halfInning: "top",
        isTopInning: true,
        inning: 1,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: false,
      },
      playEvents: [
        buildPlayEvent({ count: buildCount({ balls: 0, strikes: 0, outs: 3 }) }),
      ],
      count: buildCount({ outs: 3 }),
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play], currentPlay: play },
        linescore: buildLinescore({ inningHalf: "Top", isTopInning: true, outs: 3 }),
      },
    });

    expect(parseAtBatSnapshot(feed, FETCHED_AT)?.outs).toBe(2);
  });

  it("extracts fielder IDs from linescore.defense into snapshot.defense", () => {
    const snapshot = parseAtBatSnapshot(buildLiveFeedResponse(), FETCHED_AT);

    expect(snapshot?.defense).toBeDefined();
    expect(snapshot?.defense?.pitcher).toBe(656731);
    expect(snapshot?.defense?.center).toBe(808982);
    expect(snapshot?.defense?.left).toBe(671218);
    expect(snapshot?.defense?.shortstop).toBe(642715);
    expect(snapshot?.defense?.third).toBe(656305);
  });

  it("sets defense to undefined when linescore.defense has no fielder slots", () => {
    const linescore = buildLinescore({
      defense: { pitcher: { id: 656731, fullName: "Gregory Soto" } },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore,
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    // Only pitcher in the defense object — no outfield/infield slots → undefined
    expect(snapshot?.defense).toBeUndefined();
  });

  it("extracts runner IDs from the previous play's postOn fields", () => {
    const priorPlay = buildPlay({
      about: {
        atBatIndex: 4,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:29:00Z",
        isComplete: true,
      },
      matchup: {
        ...buildPlay().matchup,
        postOnFirst: { id: 111111, fullName: "Runner One", link: "/api/v1/people/111111" },
        postOnThird: { id: 333333, fullName: "Runner Three", link: "/api/v1/people/333333" },
      },
    });
    const currentPlay = buildPlay({
      about: {
        atBatIndex: 5,
        halfInning: "bottom",
        isTopInning: false,
        inning: 9,
        startTime: "2026-06-17T04:30:00Z",
        isComplete: false,
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [priorPlay, currentPlay], currentPlay },
        linescore: buildLinescore(),
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    expect(snapshot?.runnerIds).toEqual({ first: 111111, third: 333333 });
    expect(snapshot?.runnerOnFirst).toBe(true);
    expect(snapshot?.runnerOnSecond).toBe(false);
    expect(snapshot?.runnerOnThird).toBe(true);
  });

  it("parses batting order from boxscore for the batting team", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore: buildLinescore(),
        boxscore: {
          teams: {
            home: {
              team: { id: 133 },
              battingOrder: [682998, 669477, 656305],
            },
            away: {
              team: { id: 134 },
              battingOrder: [676059, 668939],
            },
          },
        },
      },
    });
    const snapshot = parseAtBatSnapshot(feed, FETCHED_AT);

    // Default fixture is bottom of 9th — home team (133) is batting
    expect(snapshot?.battingOrder).toEqual([682998, 669477, 656305]);
  });
});

describe("parseGameLineups", () => {
  it("returns lineup entries for both teams from boxscore", () => {
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [buildPlay()], currentPlay: buildPlay() },
        linescore: buildLinescore(),
        boxscore: {
          teams: {
            home: {
              team: { id: 133 },
              battingOrder: [682998, 669477],
            },
            away: {
              team: { id: 134 },
              battingOrder: [676059, 668939, 663624],
            },
          },
        },
      },
    });

    const entries = parseGameLineups(feed, FETCHED_AT);
    expect(entries).toHaveLength(5);
    expect(entries.find((e) => e.playerId === 682998)).toMatchObject({
      gamePk: 824991,
      teamId: 133,
      battingOrder: 1,
    });
    expect(entries.find((e) => e.playerId === 663624)?.battingOrder).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// parseHistoricalAtBatSnapshots — outs normalization
// ---------------------------------------------------------------------------

describe("parseHistoricalAtBatSnapshots — outs normalization", () => {
  const aboutTop1 = {
    halfInning: "top" as const,
    isTopInning: true,
    inning: 1,
    startTime: "2026-06-17T04:30:00Z",
    isComplete: true,
  };

  it("never records more than 2 outs at the start of an at-bat", () => {
    const play0 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 0 },
      count: buildCount({ outs: 1 }),
    });
    const play1 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 1 },
      count: buildCount({ outs: 2 }),
    });
    // MLB sometimes reports outs=3 on the play that records the third out.
    const play2 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 2 },
      count: buildCount({ outs: 3 }),
    });
    const play3 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 3, isComplete: false },
      count: buildCount({ outs: 0 }),
    });

    const feed = buildLiveFeedResponse({
      liveData: {
        plays: {
          allPlays: [play0, play1, play2, play3],
          currentPlay: play3,
        },
        linescore: buildLinescore({ inningHalf: "Top", isTopInning: true, outs: 0 }),
      },
    });

    const historical = parseHistoricalAtBatSnapshots(feed, FETCHED_AT);
    expect(historical.map((s) => s.outs)).toEqual([0, 1, 2]);
  });

  it("maps runners and score from previous play postOn and result", () => {
    const play0 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 0 },
      count: buildCount({ outs: 0 }),
      result: {
        type: "atBat",
        event: "Single",
        eventType: "single",
        description: "Single.",
        rbi: 0,
        homeScore: 0,
        awayScore: 0,
      },
      matchup: {
        ...buildPlay().matchup,
        postOnFirst: { id: 111111, fullName: "Runner One", link: "/api/v1/people/111111" },
      },
    });
    const play1 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 1 },
      count: buildCount({ outs: 0 }),
      result: {
        type: "atBat",
        event: "Single",
        eventType: "single",
        description: "Single scores runner.",
        rbi: 1,
        homeScore: 0,
        awayScore: 1,
      },
      matchup: {
        ...buildPlay().matchup,
        postOnSecond: { id: 222222, fullName: "Runner Two", link: "/api/v1/people/222222" },
      },
    });
    const play2 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 2, isComplete: false },
      count: buildCount({ outs: 1 }),
    });

    const feed = buildLiveFeedResponse({
      liveData: {
        plays: {
          allPlays: [play0, play1, play2],
          currentPlay: play2,
        },
        linescore: buildLinescore({ inningHalf: "Top", isTopInning: true, outs: 1 }),
      },
    });

    const historical = parseHistoricalAtBatSnapshots(feed, FETCHED_AT);
    expect(historical).toHaveLength(2);

    expect(historical[0]).toMatchObject({
      atBatIndex: 0,
      runnerOnFirst: false,
      runnerOnSecond: false,
      runnerOnThird: false,
      homeScore: 0,
      awayScore: 0,
    });
    expect(historical[1]).toMatchObject({
      atBatIndex: 1,
      runnerOnFirst: true,
      runnerOnSecond: false,
      runnerOnThird: false,
      runnerIds: { first: 111111 },
      homeScore: 0,
      awayScore: 0,
    });
  });

  it("does not show the batter as a runner during their own at-bat after they reached base", () => {
    const batterId = 682998;
    const play0 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 0 },
      count: buildCount({ outs: 0 }),
      result: {
        type: "atBat",
        event: "Single",
        eventType: "single",
        description: "Single.",
        homeScore: 0,
        awayScore: 0,
      },
      matchup: {
        ...buildPlay().matchup,
        batter: { id: batterId, fullName: "Jacob Wilson" },
        postOnFirst: { id: batterId, fullName: "Jacob Wilson", link: `/api/v1/people/${batterId}` },
      },
    });
    const play1 = buildPlay({
      about: { ...aboutTop1, atBatIndex: 1, isComplete: false },
      count: buildCount({ outs: 0 }),
      matchup: {
        ...buildPlay().matchup,
        batter: { id: 222222, fullName: "Next Batter" },
      },
    });

    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play0, play1], currentPlay: play1 },
        linescore: buildLinescore({ inningHalf: "Top", isTopInning: true }),
      },
    });

    const historical = parseHistoricalAtBatSnapshots(feed, FETCHED_AT);
    expect(historical[0]).toMatchObject({
      atBatIndex: 0,
      batterId,
      runnerOnFirst: false,
      runnerOnSecond: false,
      runnerOnThird: false,
    });

    const live = parseAtBatSnapshot(feed, FETCHED_AT);
    expect(live).toMatchObject({
      atBatIndex: 1,
      runnerOnFirst: true,
      runnerIds: { first: batterId },
    });
  });
});

// ---------------------------------------------------------------------------
// parseAllAtBatSnapshots — includes the last at-bat (unlike historical)
// ---------------------------------------------------------------------------

describe("parseAllAtBatSnapshots", () => {
  it("includes the current (last) at-bat for a Final game feed", () => {
    const play0 = buildPlay({
      about: { ...buildPlay().about, atBatIndex: 0, isComplete: true },
    });
    const play1 = buildPlay({
      about: { ...buildPlay().about, atBatIndex: 1, isComplete: true },
    });

    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play0, play1], currentPlay: play1 },
        linescore: buildLinescore(),
      },
    });

    const historical = parseHistoricalAtBatSnapshots(feed, FETCHED_AT);
    const all = parseAllAtBatSnapshots(feed, FETCHED_AT);

    expect(historical.map((s) => s.atBatIndex)).toEqual([0]);
    expect(all.map((s) => s.atBatIndex)).toEqual([0, 1]);
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
    hasReview: false,
    isOverturned: null,
    challengerName: null,
    challengerTeamId: null,
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
