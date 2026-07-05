import { EventEmitter } from "events";
import { fetchGameStatcastCsv } from "../sources/savant/savant.client";
import { parseGameStatcastCsv } from "../sources/savant/savant.parser";
import type { SavantPitchRow } from "../sources/savant/savant.types";

export interface SavantPostgameJob {
  on(
    event: "postgamePitches",
    listener: (payload: { gamePk: number; pitches: SavantPitchRow[] }) => void
  ): this;
  on(
    event: "notReady",
    listener: (payload: { gamePk: number }) => void
  ): this;
  on(event: "error", listener: (err: Error) => void): this;
}

/**
 * Fetches postgame Statcast pitch data for a single completed game.
 *
 * Not wired by the backend orchestrator — postgame audit uses the MLB live feed.
 * Export is available for optional Statcast enrichment or future integrations.
 *
 * Savant typically lags 30–60+ minutes after game end. When the CSV is empty
 * or header-only, emits `notReady` so callers can schedule a retry.
 */
export class SavantPostgameJob extends EventEmitter implements SavantPostgameJob {
  async run(gamePk: number): Promise<void> {
    try {
      const fetchedAt = new Date().toISOString();
      const csv = await fetchGameStatcastCsv(gamePk);
      const pitches = parseGameStatcastCsv(csv, fetchedAt);

      if (pitches.length === 0) {
        this.emit("notReady", { gamePk });
        return;
      }

      this.emit("postgamePitches", { gamePk, pitches });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.emit("error", error);
    }
  }
}
