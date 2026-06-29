import { MlbLiveFeedResponse } from "./mlbLive.api.types";
import {
  parseAllAtBatSnapshots,
  parsePitchEvents,
} from "./mlbLive.parser";
import {
  CALLED_STRIKE_CALL_CODE,
  GameBackfillPayload,
} from "./mlbLive.types";

/**
 * Build a backfill payload from a Final game's archived live feed.
 * Includes every at-bat and indices of at-bats that contain called strikes.
 */
export function buildFinalGameBackfillPayload(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): GameBackfillPayload {
  const snapshots = parseAllAtBatSnapshots(feed, fetchedAt);
  const calledStrikeAtBatIndices = new Set<number>();

  for (const event of parsePitchEvents(feed, fetchedAt)) {
    if (event.callCode === CALLED_STRIKE_CALL_CODE) {
      calledStrikeAtBatIndices.add(event.atBatIndex);
    }
  }

  return {
    snapshots,
    calledStrikeAtBatIndices: [...calledStrikeAtBatIndices],
  };
}

/**
 * Best-effort estimate of when a game ended — used for Savant delay scheduling
 * when backfilling games that were not tracked live.
 */
export function inferFinalizedAtFromFeed(feed: MlbLiveFeedResponse): Date {
  const plays = feed.liveData?.plays?.allPlays ?? [];
  for (let i = plays.length - 1; i >= 0; i--) {
    const endTime = plays[i]?.about?.endTime;
    if (endTime) return new Date(endTime);
  }

  const startTime = feed.gameData?.datetime?.dateTime;
  if (startTime) {
    // Typical MLB game length when endTime is absent from the feed.
    return new Date(new Date(startTime).getTime() + 3 * 60 * 60_000);
  }

  return new Date();
}
