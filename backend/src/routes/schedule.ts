import { Router } from "express";
import { getTodaySchedule } from "../controllers/scheduleController";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get("/today", asyncHandler(getTodaySchedule));

export { router as scheduleRouter };
