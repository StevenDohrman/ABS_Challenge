import { Router } from "express";
import {
  getLatestRecommendation,
  getCurrentAtBatRecommendations,
  getGameAtBatHistory,
} from "../controllers/recommendationController";
import { getPostgameAudit } from "../controllers/postgameAuditController";
import { getGameLineups } from "../controllers/lineupController";
import { getGameExport, getBranchEligibilityHandler } from "../branch/branchController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/:gamePk/branch-eligibility", asyncHandler(getBranchEligibilityHandler));
router.get("/:gamePk/export", asyncHandler(getGameExport));
router.get("/:gamePk/lineups", asyncHandler(getGameLineups));
router.get("/:gamePk/recommendation", asyncHandler(getLatestRecommendation));
router.get(
  "/:gamePk/at-bats/current/recommendations",
  asyncHandler(getCurrentAtBatRecommendations)
);
router.get("/:gamePk/postgame-audit", asyncHandler(getPostgameAudit));
router.get("/:gamePk/at-bats", asyncHandler(getGameAtBatHistory));

export { router as recommendationsRouter };
