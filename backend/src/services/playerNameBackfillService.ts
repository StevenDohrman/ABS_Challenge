/**
 * Retroactively backfill player display names from the MLB live feed for
 * every already-tracked game.
 *
 * Savant-sourced names (season leaderboard CSVs) only cover players who meet
 * Savant's qualifying PA/pitch thresholds, so recently called-up players,
 * backup catchers, and low-usage bench bats never get a name recorded through
 * that path even though they show up in rankings (postgame audit has no
 * playing-time threshold). The MLB live feed's player dictionary has no such
 * threshold — it covers everyone who appeared in the game — so re-fetching it
 * here fills in exactly the gaps Savant leaves behind.
 *
 * Idempotent — recordPlayerNames only writes when a name actually changes.
 */
import { fetchLiveFeed, parsePlayerNamesFromFeed } from "@abs/data-pipeline";
import { prisma } from "../db/prisma";
import { recordPlayerNames } from "../db/playerNameRepository";
import { enqueuePipelineDbWork } from "../db/pipelineDbQueue";

export async function backfillPlayerNamesFromLiveFeeds(): Promise<number> {
  const games = await prisma.game.findMany({
    select: { gamePk: true },
    orderBy: { gamePk: "asc" },
  });

  let updated = 0;

  for (const { gamePk } of games) {
    try {
      const feed = await fetchLiveFeed(gamePk);
      const names = parsePlayerNamesFromFeed(feed);
      const entries = Object.entries(names).map(([id, fullName]) => ({
        playerId: Number(id),
        fullName,
      }));
      if (entries.length === 0) continue;

      updated += await enqueuePipelineDbWork(
        `player-names-backfill game=${gamePk}`,
        () => recordPlayerNames(entries),
        "low"
      );
    } catch (err) {
      console.error(
        `[playerNameBackfill] failed to fetch feed for game=${gamePk}:`,
        err
      );
    }
  }

  if (updated > 0) {
    console.log(
      `[playerNameBackfill] backfilled ${updated} player name(s) from live feeds`
    );
  }

  return updated;
}
