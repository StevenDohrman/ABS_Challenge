import { EventEmitter } from "events";
import { fetchLiveFeed, fetchLiveFeedDiff } from "./mlbLive.client";
import {
  parsePitchEvents,
  parseGameSnapshot,
  parseAtBatSnapshot,
  parseHistoricalAtBatSnapshots,
  parseMissedAtBatSnapshots,
  pitchKey,
} from "./mlbLive.parser";
import {
  MlbLivePitchEvent,
  MlbLiveGameSnapshot,
  MlbAtBatSnapshot,
  GameBackfillPayload,
  CALLED_STRIKE_CALL_CODE,
} from "./mlbLive.types";

const ACTIVE_PLAY_INTERVAL_MS = 15_000;   // reduced: multiple at-bats can happen in 30 s
const SLOW_INTERVAL_MS = 30_000;           // between-innings, pitching changes, etc.
const PREGAME_INTERVAL_MS = 5 * 60_000;
const ERROR_RETRY_INTERVAL_MS = 10_000;

/**
 * Type-safe event overloads via interface merging.
 * Consumers call poller.on('atBatStart', ...) with full type inference.
 */
export interface GamePoller {
  on(event: "atBatStart", listener: (snapshot: MlbAtBatSnapshot) => void): this;
  /**
   * Fired once on the first poll with ALL completed historical at-bats as a
   * batch, plus at-bat indices that contain called strikes (needed before
   * historical pitch replay). Remaining at-bats are pre-computed in background.
   */
  on(event: "gameBackfill", listener: (payload: GameBackfillPayload) => void): this;
  on(event: "pitchEvent", listener: (event: MlbLivePitchEvent) => void): this;
  on(event: "gameOver", listener: (payload: { gamePk: number }) => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  emit(event: "atBatStart", snapshot: MlbAtBatSnapshot): boolean;
  emit(event: "gameBackfill", payload: GameBackfillPayload): boolean;
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

      // metaData is absent on warmup/pregame partial feeds — keep the last
      // known timestamp so the next poll uses the diff endpoint correctly.
      this.lastTimestamp = feed.metaData?.timeStamp ?? this.lastTimestamp;

      // gameData / liveData may be absent on pre-game partial responses
      if (feed.gameData?.status?.abstractGameState === "Final") {
        this.emit("gameOver", { gamePk: this.gamePk });
        this.stop();
        return;
      }

      if (!feed.gameData || !feed.liveData?.plays) {
        // Partial feed with no game data yet — nothing to parse, try again soon
        this.scheduleNextPoll(PREGAME_INTERVAL_MS);
        return;
      }

      const snapshot = parseGameSnapshot(feed, fetchedAt);

      const currentAtBatIndex = feed.liveData.plays.currentPlay?.about.atBatIndex ?? -1;

      if (currentAtBatIndex !== this.lastAtBatIndex) {
        if (this.lastAtBatIndex === -1) {
          // ── First poll ────────────────────────────────────────────────────
          // Emit all completed at-bats as a single batch. The orchestrator
          // processes them sequentially (store + full pre-compute) so DB
          // connections never exceed 12 at once.
          const historical = parseHistoricalAtBatSnapshots(feed, fetchedAt);
          if (historical.length > 0) {
            const calledStrikeAtBatIndices = new Set<number>();
            for (const event of parsePitchEvents(feed, fetchedAt)) {
              if (event.callCode === CALLED_STRIKE_CALL_CODE) {
                calledStrikeAtBatIndices.add(event.atBatIndex);
              }
            }
            this.emit("gameBackfill", {
              snapshots: historical,
              calledStrikeAtBatIndices: [...calledStrikeAtBatIndices],
            });
          }
        } else if (currentAtBatIndex > this.lastAtBatIndex + 1) {
          // ── Subsequent polls: index jumped by > 1 ─────────────────────────
          // At-bats completed faster than our poll interval. Emit atBatStart
          // (full pre-computation) for every missed play so their called
          // strikes can trigger recommendations.
          for (const snap of parseMissedAtBatSnapshots(
            feed, fetchedAt, this.lastAtBatIndex, currentAtBatIndex
          )) {
            this.emit("atBatStart", snap);
          }
        }

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
