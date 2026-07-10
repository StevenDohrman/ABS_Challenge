/**
 * Coordinates pitch ingest with recommendation triggering.
 *
 * Lives outside ingestService so ingest stays DB-only; used by the live
 * orchestrator and final-game backfill replay paths.
 */

import type { MlbLivePitchEvent } from "@abs/data-pipeline";
import { handlePitchEvent } from "./ingestService";
import { triggerRecommendationIfCalledStrike } from "./challengeService";
import { applyPitchReviewContribution } from "./rankingsIncrementalService";

/** Persist a pitch event and trigger a called-strike recommendation when applicable. */
export async function ingestPitchAndTriggerRecommendation(
  event: MlbLivePitchEvent
): Promise<void> {
  const dbRowId = await handlePitchEvent(event);
  if (dbRowId !== null) {
    await triggerRecommendationIfCalledStrike(event, dbRowId);
    // Rankings gained RE reads the linked recommendation — run after trigger.
    if (
      event.hasReview &&
      event.challengerTeamId &&
      event.isOverturned !== null &&
      event.isOverturned !== undefined
    ) {
      await applyPitchReviewContribution(dbRowId);
    }
  }
}
