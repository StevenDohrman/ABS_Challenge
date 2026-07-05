import { Router } from "express";
import {
  getLatestRecommendation,
  getCurrentAtBatRecommendations,
  getGameAtBatHistory,
} from "../controllers/recommendationController";
import { getPostgameAudit } from "../controllers/postgameAuditController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/:gamePk/recommendation", asyncHandler(getLatestRecommendation));
router.get(
  "/:gamePk/at-bats/current/recommendations",
  asyncHandler(getCurrentAtBatRecommendations)
);
router.get("/:gamePk/postgame-audit", asyncHandler(getPostgameAudit));
router.get("/:gamePk/at-bats", asyncHandler(getGameAtBatHistory));

export { router as recommendationsRouter };
