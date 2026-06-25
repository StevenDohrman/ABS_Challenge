import { Router } from "express";
import {
  getLatestRecommendation,
  getCurrentAtBatRecommendations,
  getGameAtBatHistory,
} from "../controllers/recommendationController";

const router = Router();

/**
 * GET /api/games/:gamePk/recommendation
 * Returns the most recently triggered challenge recommendation for a game.
 */
router.get("/:gamePk/recommendation", getLatestRecommendation);

/**
 * GET /api/games/:gamePk/at-bats/current/recommendations
 * Returns all 12 pre-computed recommendations for the current at-bat.
 */
router.get("/:gamePk/at-bats/current/recommendations", getCurrentAtBatRecommendations);

/**
 * GET /api/games/:gamePk/at-bats
 * Returns the full at-bat history with all recommendations for a game.
 */
router.get("/:gamePk/at-bats", getGameAtBatHistory);

export { router as recommendationsRouter };
