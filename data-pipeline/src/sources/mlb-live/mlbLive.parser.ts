import { MlbLiveFeedResponse, MlbPlay } from "./mlbLive.api.types";
import {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
} from "./mlbLive.types";

/**
 * Extract all pitch events from every completed and in-progress at-bat.
 * Walks allPlays in sequence, computing the pre-pitch count for each event
 * by carrying forward the post-pitch count from the previous pitch in the same at-bat.
 */
export function parsePitchEvents(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): MlbLivePitchEvent[] {
  const result: MlbLivePitchEvent[] = [];
  for (const play of feed.liveData.plays.allPlays) {
    result.push(...parsePitchEventsFromPlay(feed.gamePk, play, fetchedAt));
  }
  return result;
}

/**
 * Capture the current game state from the linescore.
 * Suitable for understanding what is happening at the moment of a poll.
 */
export function parseGameSnapshot(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): MlbLiveGameSnapshot {
  const { linescore } = feed.liveData;
  const { teams, status } = feed.gameData;

  // linescore and team refs can be partially populated during warmup/pregame.
  return {
    gamePk: feed.gamePk,
    inning: linescore?.currentInning ?? 1,
    halfInning: linescore?.inningHalf === "Top" ? "top" : "bottom",
    detailedState: status.detailedState,
    outs: linescore?.outs ?? 0,
    balls: linescore?.balls ?? 0,
    strikes: linescore?.strikes ?? 0,
    runnerOnFirst: !!linescore?.offense?.first,
    runnerOnSecond: !!linescore?.offense?.second,
    runnerOnThird: !!linescore?.offense?.third,
    homeScore: linescore?.teams?.home?.runs ?? 0,
    awayScore: linescore?.teams?.away?.runs ?? 0,
    homeTeamId: teams?.home?.team?.id ?? 0,
    awayTeamId: teams?.away?.team?.id ?? 0,
    batterId: linescore?.offense?.batter?.id,
    pitcherId: linescore?.defense?.pitcher?.id,
    fetchedAt,
  };
}

/**
 * Capture the game state at the start of the current at-bat.
 * Returns null if there is no current play (pregame).
 *
 * battingTeamId / fieldingTeamId are read from linescore.defense when present.
 * If the API omits them, they are inferred from gameData.teams based on half-inning
 * (away team bats in the top half, home team bats in the bottom half).
 */
export function parseAtBatSnapshot(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): MlbAtBatSnapshot | null {
  const { currentPlay } = feed.liveData.plays;
  if (!currentPlay) return null;

  const { linescore } = feed.liveData;
  const homeTeamId = feed.gameData.teams?.home?.team?.id ?? 0;
  const awayTeamId = feed.gameData.teams?.away?.team?.id ?? 0;
  const halfInning = currentPlay.about.halfInning;

  // matchup may be absent in very early feed snapshots
  const batterId = currentPlay.matchup?.batter?.id;
  const pitcherId = currentPlay.matchup?.pitcher?.id;
  if (!batterId || !pitcherId) return null;

  const battingTeamId =
    linescore?.defense?.battingTeam?.id ??
    (halfInning === "top" ? awayTeamId : homeTeamId);

  const fieldingTeamId =
    linescore?.defense?.fieldingTeam?.id ??
    (halfInning === "top" ? homeTeamId : awayTeamId);

  return {
    gamePk: feed.gamePk,
    atBatIndex: currentPlay.about.atBatIndex,
    batterId,
    pitcherId,
    inning: currentPlay.about.inning,
    halfInning,
    outs: linescore?.outs ?? 0,
    runnerOnFirst: !!linescore?.offense?.first,
    runnerOnSecond: !!linescore?.offense?.second,
    runnerOnThird: !!linescore?.offense?.third,
    homeScore: linescore?.teams?.home?.runs ?? 0,
    awayScore: linescore?.teams?.away?.runs ?? 0,
    battingTeamId,
    fieldingTeamId,
    fetchedAt,
  };
}

/**
 * Internal helper: extract at-bat snapshots for all plays whose atBatIndex
 * falls in the half-open range (afterIndex, beforeIndex).
 *
 * Pass afterIndex = -1 to start from the beginning.
 * Pass beforeIndex = Infinity to go to the end.
 *
 * Outs are tracked sequentially per half-inning across the whole allPlays
 * array so the outs value is correct even when the range starts mid-inning.
 * Runners and score are approximated as 0/false since the play object doesn't
 * carry per-at-bat state; the engine still produces a useful recommendation.
 */
function parsePlaysInIndexRange(
  feed: MlbLiveFeedResponse,
  fetchedAt: string,
  afterIndex: number,
  beforeIndex: number
): MlbAtBatSnapshot[] {
  if (!feed.gameData?.teams || !feed.liveData?.plays) return [];

  const homeTeamId = feed.gameData.teams?.home?.team?.id ?? 0;
  const awayTeamId = feed.gameData.teams?.away?.team?.id ?? 0;
  const snapshots: MlbAtBatSnapshot[] = [];

  let outsInHalfInning = 0;
  let prevHalfInningKey = "";

  for (const play of feed.liveData.plays.allPlays) {
    const idx = play.about.atBatIndex;

    // Track outs across the whole history so in-range plays have correct outs.
    const halfInningKey = `${play.about.inning}-${play.about.halfInning}`;
    if (halfInningKey !== prevHalfInningKey) {
      outsInHalfInning = 0;
      prevHalfInningKey = halfInningKey;
    }

    if (idx > afterIndex && idx < beforeIndex) {
      const batterId = play.matchup?.batter?.id;
      const pitcherId = play.matchup?.pitcher?.id;
      if (batterId && pitcherId) {
        const { halfInning } = play.about;
        snapshots.push({
          gamePk: feed.gamePk,
          atBatIndex: idx,
          batterId,
          pitcherId,
          inning: play.about.inning,
          halfInning,
          outs: outsInHalfInning,
          runnerOnFirst: false,
          runnerOnSecond: false,
          runnerOnThird: false,
          homeScore: 0,
          awayScore: 0,
          battingTeamId: halfInning === "top" ? awayTeamId : homeTeamId,
          fieldingTeamId: halfInning === "top" ? homeTeamId : awayTeamId,
          fetchedAt,
        });
      }
    }

    outsInHalfInning = play.count?.outs ?? outsInHalfInning;
  }

  return snapshots;
}

/**
 * Snapshots for all COMPLETED plays (everything except the active play).
 * Used on the very first poll for startup backfill.
 */
export function parseHistoricalAtBatSnapshots(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): MlbAtBatSnapshot[] {
  const currentIndex = feed.liveData?.plays?.currentPlay?.about.atBatIndex ?? -1;
  return parsePlaysInIndexRange(feed, fetchedAt, -1, currentIndex);
}

/**
 * Snapshots for completed plays whose index falls strictly between
 * afterIndex and beforeIndex (both exclusive). Used to catch at-bats that
 * completed between two consecutive polls when the index jumped by > 1.
 */
export function parseMissedAtBatSnapshots(
  feed: MlbLiveFeedResponse,
  fetchedAt: string,
  afterIndex: number,
  beforeIndex: number
): MlbAtBatSnapshot[] {
  return parsePlaysInIndexRange(feed, fetchedAt, afterIndex, beforeIndex);
}

/**
 * Deterministic deduplication key for a pitch event.
 * Prefers playId when the API provides it; falls back to a composite key.
 */
export function pitchKey(event: MlbLivePitchEvent): string {
  return event.playId ?? `${event.gamePk}-${event.atBatIndex}-${event.pitchNumber}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parsePitchEventsFromPlay(
  gamePk: number,
  play: MlbPlay,
  fetchedAt: string
): MlbLivePitchEvent[] {
  const events: MlbLivePitchEvent[] = [];
  let ballsBefore = 0;
  let strikesBefore = 0;

  for (const playEvent of play.playEvents) {
    if (!playEvent.isPitch) continue;

    events.push({
      gamePk,
      playId: playEvent.playId,
      atBatIndex: play.about.atBatIndex,
      pitchNumber: playEvent.pitchNumber,
      inning: play.about.inning,
      halfInning: play.about.halfInning,
      ballsBefore,
      strikesBefore,
      balls: playEvent.count.balls,
      strikes: playEvent.count.strikes,
      outs: playEvent.count.outs,
      batterId: play.matchup.batter.id,
      pitcherId: play.matchup.pitcher.id,
      callCode: playEvent.details.call.code,
      callDescription: playEvent.details.call.description,
      raw: playEvent,
      fetchedAt,
    });

    ballsBefore = playEvent.count.balls;
    strikesBefore = playEvent.count.strikes;
  }

  return events;
}
