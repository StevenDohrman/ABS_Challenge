import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { branchRateLimit } from "./branchRateLimit";
import {
  createBranch,
  getBranchHandler,
  patchBranch,
  deleteBranchHandler,
  exportBranch,
  importBranch,
  previewBranchGrid,
  resetBranchToFork,
  restoreBranchHandler,
} from "./branchController";

const router = Router();

const createLimit = branchRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  label: "branch create",
});
const importLimit = branchRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  label: "branch import",
});
const restoreLimit = branchRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  label: "branch restore",
});
const previewLimit = branchRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  label: "branch preview",
});

router.post("/", createLimit, asyncHandler(createBranch));
router.post("/import", importLimit, asyncHandler(importBranch));
router.post("/:branchId/restore", restoreLimit, asyncHandler(restoreBranchHandler));
router.get("/:branchId", asyncHandler(getBranchHandler));
router.patch("/:branchId", asyncHandler(patchBranch));
router.delete("/:branchId", asyncHandler(deleteBranchHandler));
router.get("/:branchId/export", asyncHandler(exportBranch));
router.post("/:branchId/preview-grid", previewLimit, asyncHandler(previewBranchGrid));
router.post("/:branchId/reset", asyncHandler(resetBranchToFork));

export { router as branchRouter };
