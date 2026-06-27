/**
 * Mid-game startup backfill: ingest historical at-bats from the first live feed
 * poll, then pre-compute recommendations so replayed pitch events can trigger.
 *
 * On pipeline restart, skips at-bats already stored in the DB so a quick
 * restart does not re-run the full game history.
 */

import type { GameBackfillPayload, MlbAtBatSnapshot } from "@abs/data-pipeline";
import { handleAtBatStart } from "./ingestService";
import { precomputeAtBatRecommendations } from "./challengeService";
import { mapSettledWithConcurrency } from "../utils/concurrency";
import { DB_LIMITS } from "../db/constants";
import { findStoredAtBatIndices } from "../db/gameRepository";
import { findAtBatIndicesWithCompletePrecompute } from "../db/recommendationRepository";

/**
 * Process completed at-bats from the first poll of a game (or only the gap
 * since the last run when the game is already partially ingested).
 *
 * Phase 1 — ingest snapshots missing from live_game_snapshots.
 *
 * Phase 2 — pre-compute only called-strike at-bats that lack a full 12-count
 * grid, then signal pitch-ready so historical pitch replay can proceed.
 *
 * Phase 3 — pre-compute any remaining at-bats still missing grids.
 */
export async function processGameBackfill(
  payload: GameBackfillPayload,
  onPitchReady?: () => void
): Promise<void> {
  const { snapshots, calledStrikeAtBatIndices } = payload;
  if (snapshots.length === 0) return;

  const gamePk = snapshots[0].gamePk;
  const snapshotByAtBat = new Map(snapshots.map((s) => [s.atBatIndex, s]));

  const [storedAtBats, completePrecompute] = await Promise.all([
    findStoredAtBatIndices(gamePk).then((indices) => new Set(indices)),
    findAtBatIndicesWithCompletePrecompute(gamePk),
  ]);

  const snapshotsToIngest = snapshots.filter(
    (snapshot) => !storedAtBats.has(snapshot.atBatIndex)
  );
  const snapshotsNeedingPrecompute = snapshots.filter(
    (snapshot) => !completePrecompute.has(snapshot.atBatIndex)
  );

  const skippedIngest = snapshots.length - snapshotsToIngest.length;
  const skippedPrecompute = snapshots.length - snapshotsNeedingPrecompute.length;

  if (snapshotsToIngest.length === 0 && snapshotsNeedingPrecompute.length === 0) {
    console.log(
      `[gameBackfill] game=${gamePk} — already up to date (${snapshots.length} at-bats, skipping ingest and precompute)`
    );
    onPitchReady?.();
    return;
  }

  if (skippedIngest > 0 || skippedPrecompute > 0) {
    console.log(
      `[gameBackfill] game=${gamePk} — resume: ${snapshotsToIngest.length} to ingest, ` +
        `${snapshotsNeedingPrecompute.length} to precompute ` +
        `(skipping ${skippedIngest} snapshots, ${skippedPrecompute} precomputed at-bats already in DB)`
    );
  }

  if (snapshotsToIngest.length > 0) {
    console.log(
      `[gameBackfill] game=${gamePk} — ingesting ${snapshotsToIngest.length} historical at-bats`
    );

    const ingestResults = await mapSettledWithConcurrency(
      snapshotsToIngest,
      DB_LIMITS.WRITE_CONCURRENCY,
      (snapshot) => handleAtBatStart(snapshot)
    );
    const ingestFailures = ingestResults.filter((r) => r.status === "rejected").length;
    if (ingestFailures > 0) {
      console.warn(
        `[gameBackfill] game=${gamePk} — ${ingestFailures} ingest errors logged above`
      );
    }
  }

  const pitchReplayAtBats = calledStrikeAtBatIndices
    .map((atBatIndex) => snapshotByAtBat.get(atBatIndex))
    .filter(
      (snapshot): snapshot is MlbAtBatSnapshot =>
        snapshot !== undefined && !completePrecompute.has(snapshot.atBatIndex)
    );

  if (pitchReplayAtBats.length > 0) {
    console.log(
      `[gameBackfill] game=${gamePk} — pre-computing ${pitchReplayAtBats.length} at-bats with called strikes`
    );
    for (const snapshot of pitchReplayAtBats) {
      await precomputeAtBatRecommendations(snapshot);
    }
  }

  onPitchReady?.();
  console.log(`[gameBackfill] game=${gamePk} — pitch replay ready`);

  const calledStrikeSet = new Set(calledStrikeAtBatIndices);
  const remaining = snapshotsNeedingPrecompute.filter(
    (snapshot) => !calledStrikeSet.has(snapshot.atBatIndex)
  );

  if (remaining.length > 0) {
    console.log(
      `[gameBackfill] game=${gamePk} — background pre-computing ${remaining.length} at-bats`
    );
    for (const snapshot of remaining) {
      await precomputeAtBatRecommendations(snapshot);
    }
  }

  console.log(`[gameBackfill] game=${gamePk} — complete`);
}
