import { EventEmitter } from "events";
import { fetchUpcomingAndLiveGames, ActiveGame } from "../sources/mlb-live/mlbLive.schedule";
import { GamePoller } from "../sources/mlb-live/mlbLive.poller";
import {
  MlbLivePitchEvent,
  MlbAtBatSnapshot,
  GameBackfillPayload,
  GameLineupEntry,
} from "../sources/mlb-live/mlbLive.types";

const GAME_CHECK_INTERVAL_MS = 5 * 60_000;

/**
 * Type-safe event overloads for LivePollJob.
 * The backend registers handlers on these events to orchestrate the system.
 *
 * Example (backend):
 *   const job = new LivePollJob();
 *   job.on('atBatStart', async (snapshot) => {
 *     // pre-compute 12 count recommendations and write to DB
 *   });
 *   job.on('pitchEvent', async (event) => {
 *     // broadcast current count/call to frontend via Supabase Realtime
 *   });
 *   await job.start();
 */
export interface LivePollJob {
  on(event: "gameDiscovered", listener: (game: ActiveGame) => void): this;
  on(event: "atBatStart", listener: (snapshot: MlbAtBatSnapshot) => void): this;
  /** All historical at-bats from a mid-game first poll, delivered as one batch. */
  on(event: "gameBackfill", listener: (payload: GameBackfillPayload) => void): this;
  on(event: "pitchEvent", listener: (event: MlbLivePitchEvent) => void): this;
  on(event: "gameOver", listener: (payload: { gamePk: number }) => void): this;
  on(event: "lineupUpdate", listener: (entries: GameLineupEntry[]) => void): this;
  /** Display names keyed by playerId, read from the feed's player dictionary. */
  on(event: "playerNames", listener: (names: Record<number, string>) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
}

/**
 * Orchestrates live polling across all active MLB games for a given day.
 *
 * - Checks for live and upcoming games every 5 minutes.
 * - Spins up a GamePoller for each newly discovered game.
 * - Tears down pollers when games reach Final.
 * - Bubbles all GamePoller events up to callers.
 */
export class LivePollJob extends EventEmitter {
  private readonly pollers = new Map<number, GamePoller>();
  private checkTimer: NodeJS.Timeout | null = null;
  private running = false;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    await this.checkForGames();
  }

  stop(): void {
    this.running = false;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }
    for (const poller of this.pollers.values()) {
      poller.stop();
    }
    this.pollers.clear();
  }

  /** Returns the gamePks of all games currently being polled. */
  activeGamePks(): number[] {
    return [...this.pollers.keys()];
  }

  private async checkForGames(): Promise<void> {
    if (!this.running) return;

    try {
      const games = await fetchUpcomingAndLiveGames();
      for (const game of games) {
        if (!this.pollers.has(game.gamePk)) {
          this.startPoller(game);
        }
      }
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }

    this.checkTimer = setTimeout(
      () => void this.checkForGames(),
      GAME_CHECK_INTERVAL_MS
    );
  }

  private startPoller(game: ActiveGame): void {
    // Notify the backend that this game exists so it can write the games row
    // before any atBatStart / pitchEvent writes try to reference it via FK.
    this.emit("gameDiscovered", game);

    const poller = new GamePoller(game.gamePk);

    poller.on("pitchEvent", (event) => this.emit("pitchEvent", event));
    poller.on("atBatStart", (snapshot) => this.emit("atBatStart", snapshot));
    poller.on("gameBackfill", (payload) => this.emit("gameBackfill", payload));
    poller.on("lineupUpdate", (entries) => this.emit("lineupUpdate", entries));
    poller.on("playerNames", (names) => this.emit("playerNames", names));
    poller.on("error", (err) => this.emit("error", err));
    poller.on("gameOver", ({ gamePk }) => {
      this.emit("gameOver", { gamePk });
      poller.stop();
      this.pollers.delete(gamePk);
    });

    this.pollers.set(game.gamePk, poller);
    poller.start();
  }
}
