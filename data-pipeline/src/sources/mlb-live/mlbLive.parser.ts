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

  return {
    gamePk: feed.gamePk,
    inning: linescore.currentInning ?? 1,
    halfInning: linescore.inningHalf === "Top" ? "top" : "bottom",
    detailedState: status.detailedState,
    outs: linescore.outs,
    balls: linescore.balls,
    strikes: linescore.strikes,
    runnerOnFirst: !!linescore.offense.first,
    runnerOnSecond: !!linescore.offense.second,
    runnerOnThird: !!linescore.offense.third,
    homeScore: linescore.teams.home.runs,
    awayScore: linescore.teams.away.runs,
    homeTeamId: teams.home.team.id,
    awayTeamId: teams.away.team.id,
    batterId: linescore.offense.batter?.id,
    pitcherId: linescore.defense.pitcher?.id,
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
  const { home, away } = feed.gameData.teams;
  const halfInning = currentPlay.about.halfInning;

  const battingTeamId =
    linescore.defense.battingTeam?.id ??
    (halfInning === "top" ? away.team.id : home.team.id);

  const fieldingTeamId =
    linescore.defense.fieldingTeam?.id ??
    (halfInning === "top" ? home.team.id : away.team.id);

  return {
    gamePk: feed.gamePk,
    atBatIndex: currentPlay.about.atBatIndex,
    batterId: currentPlay.matchup.batter.id,
    pitcherId: currentPlay.matchup.pitcher.id,
    inning: currentPlay.about.inning,
    halfInning,
    outs: linescore.outs,
    runnerOnFirst: !!linescore.offense.first,
    runnerOnSecond: !!linescore.offense.second,
    runnerOnThird: !!linescore.offense.third,
    homeScore: linescore.teams.home.runs,
    awayScore: linescore.teams.away.runs,
    battingTeamId,
    fieldingTeamId,
    fetchedAt,
  };
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
