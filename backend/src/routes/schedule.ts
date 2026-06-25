import { Router } from "express";
import { getTodaySchedule } from "../controllers/scheduleController";

const router = Router();

/**
 * GET /api/schedule/today
 * Returns today's MLB schedule enriched with tracking / recommendation status.
 * Accepts optional ?date=YYYY-MM-DD for historical lookup.
 */
router.get("/today", getTodaySchedule);

export { router as scheduleRouter };
