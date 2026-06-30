import {
  buildFinalGameBackfillPayload,
  inferFinalizedAtFromFeed,
} from "../mlbLive.backfill";
import {
  buildLiveFeedResponse,
  buildPlay,
  buildLinescore,
} from "./fixtures/mlbLiveFeed.fixture";
import { MlbLiveData } from "../mlbLive.api.types";

const FETCHED_AT = "2026-06-17T04:39:17.000Z";

describe("buildFinalGameBackfillPayload", () => {
  it("includes every at-bat and called-strike indices", () => {
    const play0 = buildPlay({ about: { ...buildPlay().about, atBatIndex: 0, isComplete: true } });
    const play1 = buildPlay({ about: { ...buildPlay().about, atBatIndex: 1, isComplete: true } });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play0, play1], currentPlay: play1 },
        linescore: buildLinescore(),
      } as MlbLiveData,
    });

    const payload = buildFinalGameBackfillPayload(feed, FETCHED_AT);

    expect(payload.snapshots).toHaveLength(2);
    expect(payload.snapshots.map((s) => s.atBatIndex)).toEqual([0, 1]);
    expect(payload.calledStrikeAtBatIndices).toEqual([0, 1]);
  });
});

describe("inferFinalizedAtFromFeed", () => {
  it("uses the last play endTime when present", () => {
    const play0 = buildPlay({
      about: {
        ...buildPlay().about,
        atBatIndex: 0,
        isComplete: true,
        endTime: "2026-06-17T07:15:00Z",
      },
    });
    const play1 = buildPlay({
      about: {
        ...buildPlay().about,
        atBatIndex: 1,
        isComplete: true,
        endTime: "2026-06-17T07:42:00Z",
      },
    });
    const feed = buildLiveFeedResponse({
      liveData: {
        plays: { allPlays: [play0, play1], currentPlay: play1 },
        linescore: buildLinescore(),
      } as MlbLiveData,
    });

    expect(inferFinalizedAtFromFeed(feed).toISOString()).toBe("2026-06-17T07:42:00.000Z");
  });

  it("falls back to scheduled start + 3h when endTime is absent", () => {
    const feed = buildLiveFeedResponse({
      gameData: {
        ...buildLiveFeedResponse().gameData,
        datetime: {
          dateTime: "2026-06-17T23:05:00Z",
          officialDate: "2026-06-17",
        },
      },
      liveData: {
        plays: { allPlays: [], currentPlay: buildPlay() },
        linescore: buildLinescore(),
      } as MlbLiveData,
    });

    const inferred = inferFinalizedAtFromFeed(feed);
    expect(inferred.getTime()).toBe(new Date("2026-06-18T02:05:00Z").getTime());
  });
});
