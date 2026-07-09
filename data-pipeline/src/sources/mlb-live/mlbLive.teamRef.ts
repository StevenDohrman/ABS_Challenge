import type { MlbLiveFeedResponse, MlbLiveTeam, MlbGameDataTeamEntry } from "./mlbLive.api.types";

export type { MlbGameDataTeamEntry };

export function resolveGameDataTeam(
  side: MlbGameDataTeamEntry | undefined
): MlbLiveTeam | null {
  if (!side) return null;
  const nested = (side as { team?: MlbLiveTeam }).team;
  if (nested?.id) return nested;
  const flat = side as MlbLiveTeam;
  if (typeof flat.id === "number") return flat;
  return null;
}

export function resolveGameDataTeamIds(feed: MlbLiveFeedResponse): {
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: MlbLiveTeam | null;
  awayTeam: MlbLiveTeam | null;
} {
  const homeTeam = resolveGameDataTeam(feed.gameData.teams?.home);
  const awayTeam = resolveGameDataTeam(feed.gameData.teams?.away);
  return {
    homeTeamId: homeTeam?.id ?? 0,
    awayTeamId: awayTeam?.id ?? 0,
    homeTeam,
    awayTeam,
  };
}
