import { Router } from "express";
import { getLatestRecommendation } from "../controllers/recommendationController";

const router = Router();

/**
 * GET /api/games/:gamePk/recommendation
 * Returns the most recently triggered challenge recommendation for a game.
 */
router.get("/:gamePk/recommendation", getLatestRecommendation);

export { router as recommendationsRouter };
