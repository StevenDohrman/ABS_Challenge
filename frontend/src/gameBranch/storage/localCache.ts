import type { BranchDocument } from "../state/branchTypes";

/** Max full branch documents kept in browser storage (oldest dropped first). */
export const MAX_LOCAL_BRANCHES = 15;

const CACHE_PREFIX = "abs-branch:";
const INDEX_KEY = "abs-branch-index";
const MIGRATION_KEY = "abs-branch-storage-v2";

export interface BranchIndexEntry {
  branchId: string;
  parentGamePk: number;
  forkedAt: string;
  lastAccessedAt: string;
  officialDate?: string;
  awayTeamAbbrev?: string;
  homeTeamAbbrev?: string;
  awayTeamName?: string;
  homeTeamName?: string;
  inning: number;
  halfInning: "top" | "bottom";
  awayScore: number;
  homeScore: number;
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function cacheKey(branchId: string): string {
  return `${CACHE_PREFIX}${branchId}`;
}

function entryFromDoc(doc: BranchDocument): BranchIndexEntry {
  const { schedule, situation } = doc;
  return {
    branchId: doc.branchId,
    parentGamePk: doc.parentGamePk,
    forkedAt: doc.forkedAt,
    lastAccessedAt: doc.forkedAt,
    officialDate: schedule.officialDate,
    awayTeamAbbrev: schedule.awayTeamAbbrev,
    homeTeamAbbrev: schedule.homeTeamAbbrev,
    awayTeamName: schedule.awayTeamName,
    homeTeamName: schedule.homeTeamName,
    inning: situation.inning,
    halfInning: situation.halfInning,
    awayScore: situation.awayScore,
    homeScore: situation.homeScore,
  };
}

function readIndexRaw(): BranchIndexEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BranchIndexEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndexRaw(entries: BranchIndexEntry[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

function evictOverflow(entries: BranchIndexEntry[], keepBranchId: string): BranchIndexEntry[] {
  let next = [...entries];
  while (next.length > MAX_LOCAL_BRANCHES) {
    const sorted = [...next].sort((a, b) =>
      a.lastAccessedAt.localeCompare(b.lastAccessedAt)
    );
    const victim = sorted.find((e) => e.branchId !== keepBranchId);
    if (!victim) break;
    localStorage.removeItem(cacheKey(victim.branchId));
    sessionStorage.removeItem(cacheKey(victim.branchId));
    next = next.filter((e) => e.branchId !== victim.branchId);
  }
  return next;
}

function upsertIndex(doc: BranchDocument, lastAccessedAt: string): void {
  if (!isBrowser()) return;
  const snapshot = entryFromDoc(doc);
  snapshot.lastAccessedAt = lastAccessedAt;

  let index = readIndexRaw().filter((e) => e.branchId !== doc.branchId);
  index.push(snapshot);
  index = evictOverflow(index, doc.branchId);
  writeIndexRaw(index);
}

function touchIndexEntry(branchId: string): void {
  if (!isBrowser()) return;
  const now = new Date().toISOString();
  const index = readIndexRaw();
  const idx = index.findIndex((e) => e.branchId === branchId);
  if (idx < 0) return;
  index[idx] = { ...index[idx]!, lastAccessedAt: now };
  writeIndexRaw(index);
}

/** One-time promotion of sessionStorage branches into localStorage + index. */
export function migrateLegacySessionBranches(): void {
  if (!isBrowser()) return;
  if (localStorage.getItem(MIGRATION_KEY)) return;

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    const raw = sessionStorage.getItem(key);
    if (!raw) continue;
    try {
      const doc = JSON.parse(raw) as BranchDocument;
      if (!doc.branchId) continue;
      localStorage.setItem(cacheKey(doc.branchId), raw);
      upsertIndex(doc, doc.forkedAt);
    } catch {
      // skip corrupt entries
    }
  }

  localStorage.setItem(MIGRATION_KEY, "1");
}

export function listLocalBranches(): BranchIndexEntry[] {
  migrateLegacySessionBranches();
  return readIndexRaw().sort((a, b) =>
    b.lastAccessedAt.localeCompare(a.lastAccessedAt)
  );
}

export function readLocalBranch(branchId: string): BranchDocument | null {
  migrateLegacySessionBranches();
  try {
    const raw =
      localStorage.getItem(cacheKey(branchId)) ??
      sessionStorage.getItem(cacheKey(branchId));
    if (!raw) return null;
    const doc = JSON.parse(raw) as BranchDocument;
    touchIndexEntry(branchId);
    return doc;
  } catch {
    return null;
  }
}

export function writeLocalBranch(doc: BranchDocument): void {
  if (!isBrowser()) return;
  migrateLegacySessionBranches();
  const now = new Date().toISOString();
  const payload = JSON.stringify(doc);
  localStorage.setItem(cacheKey(doc.branchId), payload);
  sessionStorage.removeItem(cacheKey(doc.branchId));
  upsertIndex(doc, now);
}

export function removeLocalBranch(branchId: string): void {
  if (!isBrowser()) return;
  localStorage.removeItem(cacheKey(branchId));
  sessionStorage.removeItem(cacheKey(branchId));
  writeIndexRaw(readIndexRaw().filter((e) => e.branchId !== branchId));
}

export function localBranchCount(): number {
  return listLocalBranches().length;
}
