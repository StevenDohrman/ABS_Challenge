import type { ApiResult } from "../../api/fetch";
import type { BranchDocument, BranchEligibility } from "../state/branchTypes";

const BASE = "/api/branches";
const GAMES = "/api/games";

const fetchOpts: RequestInit = { credentials: "include" };

async function fetchJsonWithCredentials<T>(
  url: string,
  init: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { ...fetchOpts, ...init });
    if (res.status === 204) return { status: "no_content" };
    if (res.status === 404 || res.status === 401) return { status: "not_found" };
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { status: "error", message: body?.error ?? `HTTP ${res.status}` };
    }
    return { status: "ok", data: (await res.json()) as T };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

export async function fetchBranchEligibility(
  gamePk: number
): Promise<ApiResult<BranchEligibility>> {
  return fetchJsonWithCredentials(`${GAMES}/${gamePk}/branch-eligibility`);
}

export async function createBranch(
  gamePk: number,
  checkpointAtBatIndex?: number
): Promise<ApiResult<{ branchId: string; branch: BranchDocument }>> {
  return fetchJsonWithCredentials(`${BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gamePk, checkpointAtBatIndex }),
  });
}

const inFlightCreates = new Map<
  number,
  Promise<ApiResult<{ branchId: string; branch: BranchDocument }>>
>();

/** Dedupes concurrent creates for the same game (e.g. React StrictMode double-mount). */
export async function createBranchOnce(
  gamePk: number,
  checkpointAtBatIndex?: number
): Promise<ApiResult<{ branchId: string; branch: BranchDocument }>> {
  const existing = inFlightCreates.get(gamePk);
  if (existing) return existing;

  const promise = createBranch(gamePk, checkpointAtBatIndex);
  inFlightCreates.set(gamePk, promise);
  try {
    return await promise;
  } finally {
    if (inFlightCreates.get(gamePk) === promise) {
      inFlightCreates.delete(gamePk);
    }
  }
}

export async function restoreBranchOnServer(
  doc: BranchDocument
): Promise<ApiResult<BranchDocument>> {
  return fetchJsonWithCredentials(`${BASE}/${doc.branchId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

export async function fetchBranch(
  branchId: string
): Promise<ApiResult<BranchDocument>> {
  return fetchJsonWithCredentials(`${BASE}/${branchId}`);
}

export async function patchBranch(
  branchId: string,
  patch: {
    situation?: Partial<BranchDocument["situation"]>;
    teams?: Partial<BranchDocument["teams"]>;
    playerNames?: Record<number, string>;
  }
): Promise<ApiResult<BranchDocument>> {
  return fetchJsonWithCredentials(`${BASE}/${branchId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function resetBranchOnServer(
  branchId: string
): Promise<ApiResult<BranchDocument>> {
  return fetchJsonWithCredentials(`${BASE}/${branchId}/reset`, { method: "POST" });
}

export async function previewBranchGrid(
  branchId: string
): Promise<ApiResult<{ grid: NonNullable<BranchDocument["previewGrid"]>; computedAt: string }>> {
  return fetchJsonWithCredentials(`${BASE}/${branchId}/preview-grid`, { method: "POST" });
}

export async function importBranchDocument(
  doc: BranchDocument
): Promise<ApiResult<{ branchId: string; branch: BranchDocument }>> {
  return fetchJsonWithCredentials(`${BASE}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
}

export function downloadBranchJson(doc: BranchDocument): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `game-${doc.parentGamePk}-branch.abs-branch.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyBranchToClipboard(doc: BranchDocument): Promise<void> {
  await navigator.clipboard.writeText(JSON.stringify(doc, null, 2));
}
