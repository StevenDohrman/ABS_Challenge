import {
  MlbLiveFeedResponse,
  MlbMatchup,
  MlbPlay,
  MlbPlayEvent,
} from "./mlbLive.api.types";
import { resolveGameDataTeamIds } from "./mlbLive.teamRef";
import {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
  DefensiveLineup,
  BaseRunners,
  GameLineupEntry,
} from "./mlbLive.types";

/** Extract runner IDs from linescore offense slots. */
function parseRunnerIds(
  offense: MlbLiveFeedResponse["liveData"]["linescore"]["offense"] | undefined
): BaseRunners {
  const result: BaseRunners = {};
  if (offense?.first?.id) result.first = offense.first.id;
  if (offense?.second?.id) result.second = offense.second.id;
  if (offense?.third?.id) result.third = offense.third.id;
  return result;
}

/** Post-play runner positions from play.matchup.postOn* (end of that at-bat). */
function parseRunnersFromMatchup(matchup: MlbMatchup | undefined): {
  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;
  runnerIds?: BaseRunners;
} {
  const runnerIds: BaseRunners = {};
  if (matchup?.postOnFirst?.id) runnerIds.first = matchup.postOnFirst.id;
  if (matchup?.postOnSecond?.id) runnerIds.second = matchup.postOnSecond.id;
  if (matchup?.postOnThird?.id) runnerIds.third = matchup.postOnThird.id;

  return {
    runnerOnFirst: runnerIds.first !== undefined,
    runnerOnSecond: runnerIds.second !== undefined,
    runnerOnThird: runnerIds.third !== undefined,
    runnerIds: Object.keys(runnerIds).length > 0 ? runnerIds : undefined,
  };
}

/** Find the play immediately before atBatIndex in allPlays. */
function findPlayBefore(allPlays: MlbPlay[], atBatIndex: number): MlbPlay | undefined {
  let best: MlbPlay | undefined;
  for (const play of allPlays) {
    if (play.about.atBatIndex < atBatIndex) {
      if (!best || play.about.atBatIndex > best.about.atBatIndex) {
        best = play;
      }
    }
  }
  return best;
}

/**
 * Runners on base when an at-bat begins.
 * Uses the previous play's postOn* fields (state after the last completed at-bat).
 * The current batter cannot occupy a base at the start of their own plate appearance.
 */
function parseRunnersAtAtBatStart(
  priorMatchup: MlbMatchup | undefined,
  batterId: number
): {
  runnerOnFirst: boolean;
  runnerOnSecond: boolean;
  runnerOnThird: boolean;
  runnerIds?: BaseRunners;
} {
  const post = parseRunnersFromMatchup(priorMatchup);
  const runnerIds: BaseRunners = { ...post.runnerIds };

  if (runnerIds.first === batterId) delete runnerIds.first;
  if (runnerIds.second === batterId) delete runnerIds.second;
  if (runnerIds.third === batterId) delete runnerIds.third;

  return {
    runnerOnFirst: runnerIds.first !== undefined,
    runnerOnSecond: runnerIds.second !== undefined,
    runnerOnThird: runnerIds.third !== undefined,
    runnerIds: Object.keys(runnerIds).length > 0 ? runnerIds : undefined,
  };
}

/** Score at the start of an at-bat — end-of-play score from the previous at-bat. */
function scoreAtPlayStart(previousPlay: MlbPlay | undefined): {
  homeScore: number;
  awayScore: number;
} {
  if (!previousPlay?.result) {
    return { homeScore: 0, awayScore: 0 };
  }
  return {
    homeScore: previousPlay.result.homeScore ?? 0,
    awayScore: previousPlay.result.awayScore ?? 0,
  };
}

/**
 * Parse batting order entries from the live feed boxscore for both teams.
 */
export function parseGameLineups(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): GameLineupEntry[] {
  const boxscore = feed.liveData?.boxscore;
  if (!boxscore?.teams) return [];

  const entries: GameLineupEntry[] = [];
  for (const side of ["home", "away"] as const) {
    const teamSide = boxscore.teams[side];
    const teamId = teamSide?.team?.id;
    const order = teamSide?.battingOrder;
    if (!teamId || !order?.length) continue;

    order.forEach((playerId, index) => {
      if (playerId) {
        entries.push({
          gamePk: feed.gamePk,
          teamId,
          playerId,
          battingOrder: index + 1,
          fetchedAt,
        });
      }
    });
  }
  return entries;
}

/**
 * Bench player IDs per team — boxscore batters not in batting order or bullpen.
 */
export {
  parseGameBench,
  parseGameBullpen,
  parsePlayerNamesFromFeed,
  assessBranchRosterFromFeed,
  parseDefenseFromBoxscore,
  resolveTeamDefenses,
  isWarmupOrGameActive,
} from "./branchRoster";
export type { BranchRosterAssessment, TeamRosterCounts } from "./branchRoster";

/**
 * Current defensive alignment from the live feed linescore.
 */
export function parseLiveDefense(
  feed: MlbLiveFeedResponse
): DefensiveLineup | undefined {
  return parseDefensiveLineup(feed.liveData?.linescore?.defense);
}

/**
 * Batting order (player IDs) for the team currently batting.
 */
function parseBattingOrderForTeam(
  feed: MlbLiveFeedResponse,
  battingTeamId: number
): number[] | undefined {
  const boxscore = feed.liveData?.boxscore;
  if (!boxscore?.teams) return undefined;

  for (const side of ["home", "away"] as const) {
    const teamSide = boxscore.teams[side];
    if (teamSide?.team?.id === battingTeamId && teamSide.battingOrder?.length) {
      return teamSide.battingOrder;
    }
  }
  return undefined;
}

/** Outs at the start of an at-bat are always 0, 1, or 2. The MLB feed sometimes reports 3 after the third out of a half-inning. */
function normalizeOutsAtAtBatStart(outs: number): number {
  return Math.min(Math.max(0, outs), 2);
}

/** Prefer the first pitch's count — that reflects the game state when the at-bat began. */
function outsAtPlayStart(play: MlbPlay, fallback: number): number {
  const firstPitch = play.playEvents?.find((e) => e.isPitch);
  const raw = firstPitch?.count?.outs ?? play.count?.outs ?? fallback;
  return normalizeOutsAtAtBatStart(raw);
}

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
  const { status } = feed.gameData;
  const { homeTeamId, awayTeamId } = resolveGameDataTeamIds(feed);

  // linescore and team refs can be partially populated during warmup/pregame.
  return {
    gamePk: feed.gamePk,
    inning: linescore?.currentInning ?? 1,
    halfInning: linescore?.inningHalf === "Top" ? "top" : "bottom",
    detailedState: status.detailedState,
    outs: normalizeOutsAtAtBatStart(linescore?.outs ?? 0),
    balls: linescore?.balls ?? 0,
    strikes: linescore?.strikes ?? 0,
    runnerOnFirst: !!linescore?.offense?.first,
    runnerOnSecond: !!linescore?.offense?.second,
    runnerOnThird: !!linescore?.offense?.third,
    homeScore: linescore?.teams?.home?.runs ?? 0,
    awayScore: linescore?.teams?.away?.runs ?? 0,
    homeTeamId,
    awayTeamId,
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
  const { homeTeamId, awayTeamId } = resolveGameDataTeamIds(feed);
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

  const previousPlay = findPlayBefore(
    feed.liveData.plays.allPlays,
    currentPlay.about.atBatIndex
  );

  return {
    gamePk: feed.gamePk,
    atBatIndex: currentPlay.about.atBatIndex,
    batterId,
    pitcherId,
    inning: currentPlay.about.inning,
    halfInning,
    outs: outsAtPlayStart(currentPlay, linescore?.outs ?? 0),
    ...parseRunnersAtAtBatStart(previousPlay?.matchup, batterId),
    ...scoreAtPlayStart(previousPlay),
    battingTeamId,
    fieldingTeamId,
    defense: parseDefensiveLineup(linescore?.defense),
    battingOrder: parseBattingOrderForTeam(feed, battingTeamId),
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
 * Runners at at-bat start come from the previous play's postOn* fields; score
 * uses the previous play's result.homeScore / awayScore.
 */
function parsePlaysInIndexRange(
  feed: MlbLiveFeedResponse,
  fetchedAt: string,
  afterIndex: number,
  beforeIndex: number
): MlbAtBatSnapshot[] {
  if (!feed.gameData?.teams || !feed.liveData?.plays) return [];

  const { homeTeamId, awayTeamId } = resolveGameDataTeamIds(feed);
  const snapshots: MlbAtBatSnapshot[] = [];

  let outsInHalfInning = 0;
  let prevHalfInningKey = "";
  let previousPlay: MlbPlay | undefined;

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
        const { homeScore, awayScore } = scoreAtPlayStart(previousPlay);
        snapshots.push({
          gamePk: feed.gamePk,
          atBatIndex: idx,
          batterId,
          pitcherId,
          inning: play.about.inning,
          halfInning,
          outs: normalizeOutsAtAtBatStart(outsInHalfInning),
          ...parseRunnersAtAtBatStart(previousPlay?.matchup, batterId),
          homeScore,
          awayScore,
          battingTeamId: halfInning === "top" ? awayTeamId : homeTeamId,
          fieldingTeamId: halfInning === "top" ? homeTeamId : awayTeamId,
          fetchedAt,
        });
      }
    }

    previousPlay = play;
    outsInHalfInning = normalizeOutsAtAtBatStart(
      play.count?.outs ?? outsInHalfInning
    );
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
 * Snapshots for every at-bat in the feed — used when backfilling a Final game
 * from the archived live feed (includes the last at-bat, unlike historical).
 */
export function parseAllAtBatSnapshots(
  feed: MlbLiveFeedResponse,
  fetchedAt: string
): MlbAtBatSnapshot[] {
  const allPlays = feed.liveData?.plays?.allPlays ?? [];
  if (allPlays.length === 0) return [];
  const maxIndex = allPlays.reduce(
    (max, play) => Math.max(max, play.about.atBatIndex),
    -1
  );
  return parsePlaysInIndexRange(feed, fetchedAt, -1, maxIndex + 1);
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

/**
 * Extract fielder IDs from the linescore defense object.
 * Returns undefined when the defense object is absent or empty (pregame,
 * historical backfill plays where per-play defense is unavailable).
 */
function parseDefensiveLineup(
  defense: MlbLiveFeedResponse["liveData"]["linescore"]["defense"] | undefined
): DefensiveLineup | undefined {
  if (!defense) return undefined;
  const result: DefensiveLineup = {};
  if (defense.pitcher?.id)   result.pitcher   = defense.pitcher.id;
  if (defense.catcher?.id)   result.catcher   = defense.catcher.id;
  if (defense.first?.id)     result.first     = defense.first.id;
  if (defense.second?.id)    result.second    = defense.second.id;
  if (defense.third?.id)     result.third     = defense.third.id;
  if (defense.shortstop?.id) result.shortstop = defense.shortstop.id;
  if (defense.left?.id)      result.left      = defense.left.id;
  if (defense.center?.id)    result.center    = defense.center.id;
  if (defense.right?.id)     result.right     = defense.right.id;
  // Only return a lineup when at least one positional fielder is present.
  // A defense object with only pitcher/catcher (or only battingTeam/fieldingTeam)
  // is not useful for fielder OAA lookup and should be treated as absent.
  const hasPositionalFielder =
    !!result.first || !!result.second || !!result.third ||
    !!result.shortstop || !!result.left || !!result.center || !!result.right;
  return hasPositionalFielder ? result : undefined;
}

/** Extract plate location and strike zone from an MLB playEvent (live feed or rawPayload). */
export function extractPitchLocationFromPlayEvent(
  playEvent: MlbPlayEvent | unknown
): Pick<
  MlbLivePitchEvent,
  "plateX" | "plateZ" | "strikeZoneTop" | "strikeZoneBottom" | "mlbZone"
> {
  const event = playEvent as MlbPlayEvent;
  const pitchData = event?.pitchData;
  if (!pitchData) return {};

  const result: Pick<
    MlbLivePitchEvent,
    "plateX" | "plateZ" | "strikeZoneTop" | "strikeZoneBottom" | "mlbZone"
  > = {};

  const pX = pitchData.coordinates?.pX;
  const pZ = pitchData.coordinates?.pZ;
  if (typeof pX === "number" && Number.isFinite(pX)) result.plateX = pX;
  if (typeof pZ === "number" && Number.isFinite(pZ)) result.plateZ = pZ;
  if (typeof pitchData.strikeZoneTop === "number" && Number.isFinite(pitchData.strikeZoneTop)) {
    result.strikeZoneTop = pitchData.strikeZoneTop;
  }
  if (
    typeof pitchData.strikeZoneBottom === "number" &&
    Number.isFinite(pitchData.strikeZoneBottom)
  ) {
    result.strikeZoneBottom = pitchData.strikeZoneBottom;
  }
  if (typeof pitchData.zone === "number" && Number.isFinite(pitchData.zone)) {
    result.mlbZone = Math.round(pitchData.zone);
  }

  return result;
}

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

    const rd = playEvent.reviewDetails;
    const location = extractPitchLocationFromPlayEvent(playEvent);
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
      hasReview: playEvent.details.hasReview === true,
      isOverturned: rd ? (rd.inProgress ? null : rd.isOverturned) : null,
      challengerName: rd?.player?.fullName ?? null,
      challengerTeamId: rd?.challengeTeamId ?? null,
      ...location,
      raw: playEvent,
      fetchedAt,
    });

    ballsBefore = playEvent.count.balls;
    strikesBefore = playEvent.count.strikes;
  }

  return events;
}
