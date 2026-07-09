import type { MlbBoxscoreTeam, MlbLiveFeedResponse } from "./mlbLive.api.types";
import type { DefensiveLineup } from "./mlbLive.types";
import { resolveGameDataTeamIds } from "./mlbLive.teamRef";

export interface TeamRosterCounts {
  lineup: number;
  bench: number;
  bullpen: number;
  batters: number;
  pitchers: number;
}

export interface BranchRosterAssessment {
  eligible: boolean;
  reason: string;
  /** True when batting orders are partial or derived from roster pool only. */
  lineupIncomplete: boolean;
  warmupStarted: boolean;
  roster: {
    home: TeamRosterCounts;
    away: TeamRosterCounts;
  };
}

const WARMUP_STATES = [
  "warmup",
  "pre-game",
  "pregame",
  "in progress",
  "manager challenge",
  "delayed",
  "suspended",
  "final",
  "game over",
];

export function isWarmupOrGameActive(detailedState: string): boolean {
  const lower = detailedState.toLowerCase();
  return WARMUP_STATES.some((s) => lower.includes(s));
}

function collectPitcherIds(team: MlbBoxscoreTeam | undefined): Set<number> {
  const ids = new Set<number>();
  for (const id of team?.bullpen ?? []) {
    if (id) ids.add(id);
  }
  // Pitchers who have appeared — exclude from bench, but don't treat entire pitchers[] as bullpen.
  for (const entry of Object.values(team?.players ?? {})) {
    const pid = entry?.person?.id;
    const pos = entry?.position?.abbreviation ?? entry?.position?.code;
    const posType = entry?.position?.type;
    if (pid && (pos === "P" || posType === "Pitcher")) ids.add(pid);
  }
  return ids;
}

function parseBenchForTeam(team: MlbBoxscoreTeam | undefined): number[] {
  if (!team) return [];
  const order = new Set(team.battingOrder ?? []);
  const pitchers = collectPitcherIds(team);
  const ids = new Set<number>();

  for (const id of team.bench ?? []) {
    if (id && !order.has(id) && !pitchers.has(id)) ids.add(id);
  }

  for (const entry of Object.values(team.players ?? {})) {
    const pid = entry?.person?.id;
    if (pid && entry.isOnBench && !order.has(pid) && !pitchers.has(pid)) {
      ids.add(pid);
    }
  }

  for (const id of team.batters ?? []) {
    if (id && !order.has(id) && !pitchers.has(id)) ids.add(id);
  }

  return [...ids];
}

function countBenchPlayers(team: MlbBoxscoreTeam | undefined): number {
  return parseBenchForTeam(team).length;
}

function countTeamRoster(team: MlbBoxscoreTeam | undefined): TeamRosterCounts {
  const lineup = (team?.battingOrder ?? []).filter(Boolean).length;
  const batters = (team?.batters ?? []).filter(Boolean).length;
  const bullpenRaw = (team?.bullpen ?? []).filter(Boolean).length;
  const pitchers = (team?.pitchers ?? []).filter(Boolean).length;
  const bench = countBenchPlayers(team);
  const bullpen =
    bullpenRaw > 0
      ? bullpenRaw
      : pitchers > 0
        ? Math.max(0, pitchers - (lineup > 0 ? 1 : 0))
        : 0;

  return { lineup, bench, bullpen, batters, pitchers };
}

function teamHasRosterPool(counts: TeamRosterCounts): boolean {
  return counts.batters >= 1 && (counts.bullpen >= 1 || counts.pitchers >= 1);
}

/**
 * Decide whether a game can be branched from the MLB live feed.
 * Eligible during warmup once both teams expose roster data in boxscore.
 */
export function assessBranchRosterFromFeed(
  feed: MlbLiveFeedResponse
): BranchRosterAssessment {
  const detailedState = feed.gameData.status.detailedState ?? "";
  const abstractState = feed.gameData.status.abstractGameState;
  const warmupStarted = isWarmupOrGameActive(detailedState);

  const empty = { home: countTeamRoster(undefined), away: countTeamRoster(undefined) };

  const boxscore = feed.liveData?.boxscore;
  if (!boxscore?.teams) {
    return {
      eligible: false,
      reason: warmupStarted
        ? "Waiting for MLB to publish boxscore rosters."
        : "Rosters not published yet — usually available at warmup.",
      lineupIncomplete: true,
      warmupStarted,
      roster: empty,
    };
  }

  const home = countTeamRoster(boxscore.teams.home);
  const away = countTeamRoster(boxscore.teams.away);
  const roster = { home, away };

  const bothHaveLineup = home.lineup >= 1 && away.lineup >= 1;
  const bothHavePool = teamHasRosterPool(home) && teamHasRosterPool(away);

  if (bothHaveLineup) {
    const incomplete = home.lineup < 9 || away.lineup < 9;
    return {
      eligible: true,
      reason: incomplete
        ? "Lineups published — some slots may still be TBD."
        : "Lineups published for both teams.",
      lineupIncomplete: incomplete,
      warmupStarted,
      roster,
    };
  }

  if (warmupStarted && bothHavePool) {
    return {
      eligible: true,
      reason:
        "Available during warmup once MLB publishes rosters. Lineups may be incomplete.",
      lineupIncomplete: true,
      warmupStarted,
      roster,
    };
  }

  if (abstractState === "Final" && home.batters >= 1 && away.batters >= 1) {
    return {
      eligible: true,
      reason: "Final game — roster from boxscore.",
      lineupIncomplete: home.lineup < 9 || away.lineup < 9,
      warmupStarted: true,
      roster,
    };
  }

  if (warmupStarted) {
    return {
      eligible: false,
      reason: "Waiting for both teams to publish roster data (lineup or bench/bullpen).",
      lineupIncomplete: true,
      warmupStarted,
      roster,
    };
  }

  return {
    eligible: false,
    reason: "Rosters not published yet — usually available at warmup.",
    lineupIncomplete: true,
    warmupStarted,
    roster,
  };
}

/** Bench = position players available to sub; prefers MLB bench array. */
export function parseGameBench(
  feed: MlbLiveFeedResponse
): { home: number[]; away: number[] } {
  const boxscore = feed.liveData?.boxscore;
  if (!boxscore?.teams) {
    return { home: [], away: [] };
  }

  return {
    home: parseBenchForTeam(boxscore.teams.home),
    away: parseBenchForTeam(boxscore.teams.away),
  };
}

/** Relief corps IDs — prefers explicit bullpen array, else pitchers minus starter hint. */
export function parseGameBullpen(
  feed: MlbLiveFeedResponse
): { home: number[]; away: number[] } {
  const boxscore = feed.liveData?.boxscore;
  if (!boxscore?.teams) return { home: [], away: [] };

  const { homeTeamId, awayTeamId } = resolveGameDataTeamIds(feed);
  const fieldingTeamId = feed.liveData.linescore?.defense?.fieldingTeam?.id;
  const activePitcherId = feed.liveData.linescore?.defense?.pitcher?.id;
  const probableHome = feed.gameData.probablePitchers?.home?.id;
  const probableAway = feed.gameData.probablePitchers?.away?.id;

  const result: { home: number[]; away: number[] } = { home: [], away: [] };

  for (const side of ["home", "away"] as const) {
    const teamSide = boxscore.teams[side];
    const teamId = teamSide?.team?.id ?? (side === "home" ? homeTeamId : awayTeamId);

    if (teamSide?.bullpen?.length) {
      result[side] = teamSide.bullpen.filter(Boolean);
      continue;
    }

    const pitchers = (teamSide?.pitchers ?? []).filter(Boolean);
    if (pitchers.length === 0) {
      result[side] = [];
      continue;
    }

    let starter: number | undefined;
    if (activePitcherId && fieldingTeamId === teamId) {
      starter = activePitcherId;
    } else if (side === "home" && probableHome) {
      starter = probableHome;
    } else if (side === "away" && probableAway) {
      starter = probableAway;
    } else {
      starter = pitchers[0];
    }

    result[side] = pitchers.filter((id) => id !== starter);
  }

  return result;
}

/** Display names from live feed player dictionary. */
export function parsePlayerNamesFromFeed(
  feed: MlbLiveFeedResponse
): Record<number, string> {
  const names: Record<number, string> = {};
  const players = feed.gameData.players ?? {};
  for (const entry of Object.values(players)) {
    if (entry?.id && entry.fullName) {
      names[entry.id] = entry.fullName;
    }
  }
  const prob = feed.gameData.probablePitchers;
  if (prob?.home?.id && prob.home.fullName) names[prob.home.id] = prob.home.fullName;
  if (prob?.away?.id && prob.away.fullName) names[prob.away.id] = prob.away.fullName;
  return names;
}

const POS_TO_DEFENSE_SLOT: Record<string, keyof DefensiveLineup> = {
  P: "pitcher",
  C: "catcher",
  "1B": "first",
  "2B": "second",
  "3B": "third",
  SS: "shortstop",
  LF: "left",
  CF: "center",
  RF: "right",
};

function mergeDefensiveLineups(
  base: DefensiveLineup,
  overlay: DefensiveLineup | undefined
): DefensiveLineup {
  if (!overlay) return base;
  const merged: DefensiveLineup = { ...base };
  for (const slot of Object.keys(POS_TO_DEFENSE_SLOT).map(
    (k) => POS_TO_DEFENSE_SLOT[k]!
  )) {
    if (overlay[slot]) merged[slot] = overlay[slot];
  }
  return merged;
}

function lookupBoxscorePlayer(
  teamSide: MlbBoxscoreTeam,
  playerId: number
): { position?: { abbreviation?: string } } | undefined {
  const players = teamSide.players;
  if (!players) return undefined;
  return players[`ID${playerId}`] ?? Object.values(players).find((p) => p.person?.id === playerId);
}

/**
 * Starting defensive alignment from boxscore batting-order positions.
 * DH slots are skipped; pitcher falls back to probable starter / pitchers list.
 */
export function parseDefenseFromBoxscore(
  feed: MlbLiveFeedResponse,
  side: "home" | "away"
): DefensiveLineup {
  const teamSide = feed.liveData?.boxscore?.teams?.[side];
  if (!teamSide) return {};

  const result: DefensiveLineup = {};

  for (const playerId of teamSide.battingOrder ?? []) {
    if (!playerId) continue;
    const entry = lookupBoxscorePlayer(teamSide, playerId);
    const abbr = entry?.position?.abbreviation;
    if (!abbr || abbr === "DH") continue;
    const slot = POS_TO_DEFENSE_SLOT[abbr];
    if (slot && !result[slot]) result[slot] = playerId;
  }

  if (!result.pitcher) {
    const probable = feed.gameData.probablePitchers?.[side]?.id;
    if (probable) {
      result.pitcher = probable;
    } else {
      const pitchers = (teamSide.pitchers ?? []).filter(Boolean);
      if (pitchers[0]) result.pitcher = pitchers[0];
    }
  }

  return result;
}

/**
 * Both teams' defensive alignments — boxscore positions with live linescore overlay
 * on the team currently fielding.
 */
export function resolveTeamDefenses(feed: MlbLiveFeedResponse): {
  home: DefensiveLineup;
  away: DefensiveLineup;
} {
  const { homeTeamId, awayTeamId } = resolveGameDataTeamIds(feed);
  const homeBase = parseDefenseFromBoxscore(feed, "home");
  const awayBase = parseDefenseFromBoxscore(feed, "away");

  const liveDefense = parseLiveDefenseFromFeed(feed);
  const fieldingTeamId = feed.liveData.linescore?.defense?.fieldingTeam?.id;

  if (liveDefense && fieldingTeamId === homeTeamId) {
    return { home: mergeDefensiveLineups(homeBase, liveDefense), away: awayBase };
  }
  if (liveDefense && fieldingTeamId === awayTeamId) {
    return { home: homeBase, away: mergeDefensiveLineups(awayBase, liveDefense) };
  }

  return { home: homeBase, away: awayBase };
}

function parseLiveDefenseFromFeed(feed: MlbLiveFeedResponse): DefensiveLineup | undefined {
  const defense = feed.liveData?.linescore?.defense;
  if (!defense) return undefined;
  const result: DefensiveLineup = {};
  if (defense.pitcher?.id) result.pitcher = defense.pitcher.id;
  if (defense.catcher?.id) result.catcher = defense.catcher.id;
  if (defense.first?.id) result.first = defense.first.id;
  if (defense.second?.id) result.second = defense.second.id;
  if (defense.third?.id) result.third = defense.third.id;
  if (defense.shortstop?.id) result.shortstop = defense.shortstop.id;
  if (defense.left?.id) result.left = defense.left.id;
  if (defense.center?.id) result.center = defense.center.id;
  if (defense.right?.id) result.right = defense.right.id;
  const hasPositional =
    !!result.first ||
    !!result.second ||
    !!result.third ||
    !!result.shortstop ||
    !!result.left ||
    !!result.center ||
    !!result.right;
  return hasPositional ? result : undefined;
}
