import { EventEmitter } from "events";
import { fetchLiveFeed, fetchLiveFeedDiff } from "./mlbLive.client";
import {
  parsePitchEvents,
  parseGameSnapshot,
  parseAtBatSnapshot,
  pitchKey,
} from "./mlbLive.parser";
import {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
} from "./mlbLive.types";

const ACTIVE_PLAY_INTERVAL_MS = 30_000;
const SLOW_INTERVAL_MS = 60_000;
const PREGAME_INTERVAL_MS = 5 * 60_000;
const ERROR_RETRY_INTERVAL_MS = 10_000;

/**
 * Type-safe event overloads via interface merging.
 * Consumers call poller.on('atBatStart', ...) with full type inference.
 */
export interface GamePoller {
  on(event: "atBatStart", listener: (snapshot: MlbAtBatSnapshot) => void): this;
  on(event: "pitchEvent", listener: (event: MlbLivePitchEvent) => void): this;
  on(event: "gameOver", listener: (payload: { gamePk: number }) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  emit(event: "atBatStart", snapshot: MlbAtBatSnapshot): boolean;
  emit(event: "pitchEvent", pitchEvent: MlbLivePitchEvent): boolean;
  emit(event: "gameOver", payload: { gamePk: number }): boolean;
  emit(event: "error", err: Error): boolean;
}

/**
 * Polls the MLB live feed for a single game.
 *
 * - First poll fetches the full feed; subsequent polls use the diff endpoint
 *   to reduce payload size.
 * - Pitch events are deduplicated across polls so the same pitch is never
 *   emitted twice even if the diff endpoint repeats it.
 * - Emits `atBatStart` whenever the at-bat index advances, giving the backend
 *   the signal to pre-compute recommendations for all 12 count states.
 * - Stops itself and emits `gameOver` when the game reaches Final.
 */
export class GamePoller extends EventEmitter {
  readonly gamePk: number;

  private lastTimestamp: string | null = null;
  private lastAtBatIndex = -1;
  private readonly seenPitchKeys = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(gamePk: number) {
    super();
    this.gamePk = gamePk;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleNextPoll(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextPoll(delayMs: number): void {
    this.timer = setTimeout(() => void this.poll(), delayMs);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    const fetchedAt = new Date().toISOString();

    try {
      const feed = this.lastTimestamp
        ? await fetchLiveFeedDiff(this.gamePk, this.lastTimestamp)
        : await fetchLiveFeed(this.gamePk);

      this.lastTimestamp = feed.metaData.timeStamp;

      if (feed.gameData.status.abstractGameState === "Final") {
        this.emit("gameOver", { gamePk: this.gamePk });
        this.stop();
        return;
      }

      const snapshot = parseGameSnapshot(feed, fetchedAt);

      const currentAtBatIndex = feed.liveData.plays.currentPlay?.about.atBatIndex ?? -1;
      if (currentAtBatIndex !== this.lastAtBatIndex) {
        this.lastAtBatIndex = currentAtBatIndex;
        const atBatSnapshot = parseAtBatSnapshot(feed, fetchedAt);
        if (atBatSnapshot) {
          this.emit("atBatStart", atBatSnapshot);
        }
      }

      for (const event of parsePitchEvents(feed, fetchedAt)) {
        const key = pitchKey(event);
        if (!this.seenPitchKeys.has(key)) {
          this.seenPitchKeys.add(key);
          this.emit("pitchEvent", event);
        }
      }

      this.scheduleNextPoll(this.intervalFor(snapshot));
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
      this.scheduleNextPoll(ERROR_RETRY_INTERVAL_MS);
    }
  }

  private intervalFor(snapshot: MlbLiveGameSnapshot): number {
    switch (snapshot.detailedState) {
      case "Pre-Game":
      case "Warmup":
        return PREGAME_INTERVAL_MS;
      case "In Progress":
        return ACTIVE_PLAY_INTERVAL_MS;
      default:
        // Delayed, Manager challenge, between innings, pitching changes, etc.
        return SLOW_INTERVAL_MS;
    }
  }
}
