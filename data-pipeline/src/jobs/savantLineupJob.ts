import { EventEmitter } from "events";
import { fetchPlayerStatcastHistoryCsv } from "../sources/savant/savant.client";
import { parsePlayerStatcastHistory } from "../sources/savant/savant.parser";
import { SavantPlayerPitchHistory } from "../sources/savant/savant.types";

/** A single player entry for the lineup job. */
export interface LineupPlayer {
  playerId: number;
  /** "batter" to fetch pitches seen; "pitcher" to fetch pitches thrown. */
  playerType: "batter" | "pitcher";
}

/** Payload emitted for each player that completes successfully. */
export interface PlayerHistoryResult {
  playerId: number;
  playerType: "batter" | "pitcher";
  history: SavantPlayerPitchHistory[];
}

/**
 * Type-safe event overloads for SavantLineupJob.
 *
 * Example (backend — called once lineups are confirmed):
 *   const job = new SavantLineupJob();
 *   job.on('playerHistory', ({ playerId, history }) => {
 *     cache.set(playerId, history);
 *   });
 *   await job.run(lineupPlayers, 2026);
 */
export interface SavantLineupJob {
  on(
    event: "playerHistory",
    listener: (result: PlayerHistoryResult) => void
  ): this;
  on(event: "error", listener: (err: Error) => void): this;
}

const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_BATCH_DELAY_MS = 500;

/**
 * Fetches per-player Statcast pitch history for a confirmed game lineup.
 *
 * Not wired by the backend orchestrator — pregame context comes from
 * SavantDailyJob. Export is available for optional lineup-time enrichment.
 *
 * Called at lineup confirmation time (not as part of the daily bulk job).
 * Typically covers ~18–26 players across both teams in a single game.
 *
 * Requests are issued in small batches with a configurable delay between
 * batches to avoid hitting Savant's rate limit.
 *
 * Each player that completes successfully emits a `playerHistory` event
 * immediately so the backend can begin caching without waiting for the
 * full lineup to finish.
 *
 * Players that fail emit an `error` event; remaining players continue.
 */
export class SavantLineupJob extends EventEmitter {
  private readonly batchSize: number;
  private readonly batchDelayMs: number;

  constructor({
    batchSize = DEFAULT_BATCH_SIZE,
    batchDelayMs = DEFAULT_BATCH_DELAY_MS,
  }: {
    batchSize?: number;
    batchDelayMs?: number;
  } = {}) {
    super();
    this.batchSize = batchSize;
    this.batchDelayMs = batchDelayMs;
  }

  async run(players: LineupPlayer[], season: number): Promise<void> {
    const fetchedAt = new Date().toISOString();

    for (let i = 0; i < players.length; i += this.batchSize) {
      const batch = players.slice(i, i + this.batchSize);

      await Promise.allSettled(
        batch.map((player) => this.fetchOne(player, season, fetchedAt))
      );

      const hasMore = i + this.batchSize < players.length;
      if (hasMore && this.batchDelayMs > 0) {
        await delay(this.batchDelayMs);
      }
    }
  }

  private async fetchOne(
    player: LineupPlayer,
    season: number,
    fetchedAt: string
  ): Promise<void> {
    try {
      const csv = await fetchPlayerStatcastHistoryCsv(
        player.playerId,
        season,
        player.playerType
      );
      const history = parsePlayerStatcastHistory(csv, fetchedAt);

      this.emit("playerHistory", {
        playerId: player.playerId,
        playerType: player.playerType,
        history,
      } satisfies PlayerHistoryResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit(
        "error",
        new Error(
          `SavantLineupJob [player ${player.playerId}/${player.playerType}]: ${message}`
        )
      );
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
