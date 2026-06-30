import { Router } from "express";
import {
  getPlayerRankings,
  getRankingsBundle,
  getTeamRankings,
} from "../controllers/rankingsController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/", asyncHandler(getRankingsBundle));
router.get("/players", asyncHandler(getPlayerRankings));
router.get("/teams", asyncHandler(getTeamRankings));

export { router as rankingsRouter };
