import {
  patchBranch,
  previewBranchGrid,
  resetBranchOnServer,
  restoreBranchOnServer,
} from "../api/branchClient";
import type { BranchDocument } from "../state/branchTypes";

interface BranchSyncOptions {
  delayMs?: number;
  previewDelayMs?: number;
  onPreview?: (
    grid: NonNullable<BranchDocument["previewGrid"]>,
    computedAt: string
  ) => void;
}

export function createBranchSync(
  branchId: string,
  getDoc: () => BranchDocument | null,
  options: BranchSyncOptions = {}
) {
  const { delayMs = 400, previewDelayMs = 400, onPreview } = options;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let previewTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: Partial<BranchDocument> | null = null;

  function schedulePreview() {
    if (!onPreview) return;
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(async () => {
      const result = await previewBranchGrid(branchId);
      if (result.status === "ok") {
        onPreview(result.data.grid, result.data.computedAt);
      }
    }, previewDelayMs);
  }

  async function pushToServer(body: Partial<BranchDocument>) {
    const result = await patchBranch(branchId, {
      situation: body.situation,
      teams: body.teams,
      playerNames: body.playerNames,
    });
    if (result.status === "not_found") {
      const doc = getDoc();
      if (doc) {
        const restored = await restoreBranchOnServer(doc);
        if (restored.status === "ok") {
          await patchBranch(branchId, {
            situation: doc.situation,
            teams: doc.teams,
            playerNames: doc.playerNames,
          });
        }
      }
    }
    schedulePreview();
  }

  return {
    queue(doc: BranchDocument) {
      pending = {
        situation: doc.situation,
        teams: doc.teams,
        playerNames: doc.playerNames,
      };
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (!pending) return;
        const body = pending;
        pending = null;
        await pushToServer(body);
      }, delayMs);
    },
    requestPreview() {
      schedulePreview();
    },
    async resetRemote() {
      const result = await resetBranchOnServer(branchId);
      if (result.status === "not_found") {
        const doc = getDoc();
        if (doc) return restoreBranchOnServer(doc);
      }
      return result;
    },
    flush() {
      if (timer) clearTimeout(timer);
      if (previewTimer) clearTimeout(previewTimer);
      timer = null;
      previewTimer = null;
      pending = null;
    },
  };
}
