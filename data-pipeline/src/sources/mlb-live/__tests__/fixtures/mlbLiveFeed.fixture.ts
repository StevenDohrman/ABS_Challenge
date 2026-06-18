import {
  MlbLiveFeedResponse,
  MlbLiveGameData,
  MlbLiveData,
  MlbPlay,
  MlbPlayEvent,
  MlbCount,
  MlbLinescore,
} from "../../mlbLive.api.types";
import { LIVE_STATUS } from "./mlbSchedule.fixture";

// ---------------------------------------------------------------------------
// Count / play-event builders
// ---------------------------------------------------------------------------

export function buildCount(overrides: Partial<MlbCount> = {}): MlbCount {
  return { balls: 0, strikes: 0, outs: 0, ...overrides };
}

export function buildPlayEvent(overrides: Partial<MlbPlayEvent> = {}): MlbPlayEvent {
  return {
    details: {
      call: { code: "C", description: "Called Strike" },
      type: { code: "pitch", description: "Pitch" },
    },
    count: buildCount({ balls: 0, strikes: 1, outs: 0 }),
    pitchNumber: 1,
    index: 0,
    isPitch: true,
    type: "pitch",
    playId: "test-play-id-001",
    ...overrides,
  };
}

export function buildBallEvent(overrides: Partial<MlbPlayEvent> = {}): MlbPlayEvent {
  return buildPlayEvent({
    details: {
      call: { code: "B", description: "Ball" },
      type: { code: "pitch", description: "Pitch" },
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Play builder
// ---------------------------------------------------------------------------

export function buildPlay(overrides: Partial<MlbPlay> = {}): MlbPlay {
  return {
    result: {
      type: "atBat",
      event: "Strikeout",
      eventType: "strikeout",
      description: "Jacob Wilson strikes out swinging.",
    },
    about: {
      atBatIndex: 0,
      halfInning: "bottom",
      isTopInning: false,
      inning: 9,
      startTime: "2026-06-17T04:30:00Z",
      isComplete: false,
    },
    count: buildCount({ balls: 0, strikes: 2, outs: 2 }),
    matchup: {
      batter: { id: 682998, fullName: "Jacob Wilson" },
      pitcher: { id: 656731, fullName: "Gregory Soto" },
      batSide: { code: "R" },
      pitchHand: { code: "L" },
    },
    playEvents: [buildPlayEvent()],
    atBatIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Linescore builder
// ---------------------------------------------------------------------------

export function buildLinescore(
  overrides: Partial<MlbLinescore> = {}
): MlbLinescore {
  return {
    currentInning: 9,
    currentInningOrdinal: "9th",
    inningHalf: "Bottom",
    isTopInning: false,
    scheduledInnings: 9,
    outs: 2,
    balls: 0,
    strikes: 2,
    teams: {
      home: { runs: 5, hits: 8, errors: 0 },
      away: { runs: 6, hits: 10, errors: 1 },
    },
    offense: {
      batter: { id: 682998, fullName: "Jacob Wilson" },
    },
    defense: {
      pitcher: { id: 656731, fullName: "Gregory Soto" },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Full live feed response builder
// ---------------------------------------------------------------------------

export function buildLiveFeedResponse(
  overrides: Partial<MlbLiveFeedResponse> = {}
): MlbLiveFeedResponse {
  const currentPlay = buildPlay();
  const linescore = buildLinescore();

  const gameData: MlbLiveGameData = {
    game: { pk: 824991, type: "R", doubleHeader: "N", gameNumber: 1 },
    datetime: {
      dateTime: "2026-06-17T00:40:00Z",
      officialDate: "2026-06-16",
    },
    status: LIVE_STATUS,
    teams: {
      home: { team: { id: 133, name: "Oakland Athletics", abbreviation: "ATH" } },
      away: { team: { id: 134, name: "Pittsburgh Pirates", abbreviation: "PIT" } },
    },
    players: {
      "ID682998": {
        id: 682998,
        fullName: "Jacob Wilson",
        batSide: { code: "R" },
      },
      "ID656731": {
        id: 656731,
        fullName: "Gregory Soto",
        pitchHand: { code: "L" },
      },
    },
  };

  const liveData: MlbLiveData = {
    plays: {
      allPlays: [currentPlay],
      currentPlay,
    },
    linescore,
  };

  return {
    gamePk: 824991,
    metaData: {
      wait: 10,
      timeStamp: "20260617_043917",
    },
    gameData,
    liveData,
    ...overrides,
  };
}
