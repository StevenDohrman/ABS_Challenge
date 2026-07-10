import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import type { BranchDocument } from "./branchTypes";
import { getBranchSessionSecret, isBranchCookieSecure } from "./branchSessionConfig";

const TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_BRANCHES_PER_SESSION = 10;
const MAX_PAYLOAD_BYTES = 512 * 1_024;

interface SessionRecord {
  branchIds: Set<string>;
  expiresAt: number;
}

interface BranchRecord {
  document: BranchDocument;
  sessionId: string;
  expiresAt: number;
}

const sessions = new Map<string, SessionRecord>();
const branches = new Map<string, BranchRecord>();

function now(): number {
  return Date.now();
}

function sweepExpired(): void {
  const t = now();
  for (const [id, rec] of sessions) {
    if (rec.expiresAt <= t) sessions.delete(id);
  }
  for (const [id, rec] of branches) {
    if (rec.expiresAt <= t) {
      branches.delete(id);
      const session = sessions.get(rec.sessionId);
      session?.branchIds.delete(id);
    }
  }
  for (const session of sessions.values()) {
    pruneStaleBranchIds(session);
  }
}

function pruneStaleBranchIds(session: SessionRecord): void {
  for (const branchId of session.branchIds) {
    if (!branches.has(branchId)) {
      session.branchIds.delete(branchId);
    }
  }
}

function signSessionId(sessionId: string): string {
  const sig = createHmac("sha256", getBranchSessionSecret())
    .update(sessionId)
    .digest("base64url");
  return `${sessionId}.${sig}`;
}

function verifySignedCookie(value: string | undefined): string | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", getBranchSessionSecret())
    .update(sessionId)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return sessionId;
}

export function parseBranchSessionCookie(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("branchSession="));
  if (!match) return null;
  const value = decodeURIComponent(match.slice("branchSession=".length));
  return verifySignedCookie(value);
}

export function createBranchSessionCookie(sessionId: string): string {
  const signed = signSessionId(sessionId);
  const maxAge = Math.floor(TTL_MS / 1_000);
  const secure = isBranchCookieSecure() ? "; Secure" : "";
  return `branchSession=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function getOrCreateSession(sessionId: string | null): string {
  sweepExpired();
  if (sessionId && sessions.has(sessionId)) {
    const rec = sessions.get(sessionId)!;
    rec.expiresAt = now() + TTL_MS;
    return sessionId;
  }
  const id = randomUUID();
  sessions.set(id, { branchIds: new Set(), expiresAt: now() + TTL_MS });
  return id;
}

function assertPayloadSize(doc: BranchDocument): void {
  const bytes = Buffer.byteLength(JSON.stringify(doc), "utf8");
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new Error(`Branch payload exceeds ${MAX_PAYLOAD_BYTES} bytes`);
  }
}

export function saveBranch(
  doc: BranchDocument,
  sessionId: string | null
): { sessionId: string; cookie: string } {
  assertPayloadSize(doc);
  const sid = getOrCreateSession(sessionId);
  const session = sessions.get(sid)!;
  pruneStaleBranchIds(session);

  if (!session.branchIds.has(doc.branchId)) {
    if (session.branchIds.size >= MAX_BRANCHES_PER_SESSION) {
      throw new Error("Session branch limit reached");
    }
    session.branchIds.add(doc.branchId);
  }

  branches.set(doc.branchId, {
    document: doc,
    sessionId: sid,
    expiresAt: now() + TTL_MS,
  });
  session.expiresAt = now() + TTL_MS;

  return { sessionId: sid, cookie: createBranchSessionCookie(sid) };
}

export function getBranch(
  branchId: string,
  sessionId: string | null
): BranchDocument | null {
  sweepExpired();
  const rec = branches.get(branchId);
  if (!rec) return null;
  if (!sessionId || rec.sessionId !== sessionId) return null;
  rec.expiresAt = now() + TTL_MS;
  const session = sessions.get(rec.sessionId);
  if (session) session.expiresAt = now() + TTL_MS;
  return rec.document;
}

export function updateBranch(
  branchId: string,
  sessionId: string | null,
  updater: (doc: BranchDocument) => BranchDocument
): BranchDocument | null {
  const existing = getBranch(branchId, sessionId);
  if (!existing) return null;
  const updated = updater(existing);
  assertPayloadSize(updated);
  const rec = branches.get(branchId)!;
  rec.document = updated;
  rec.expiresAt = now() + TTL_MS;
  return updated;
}

export function deleteBranch(branchId: string, sessionId: string | null): boolean {
  sweepExpired();
  const rec = branches.get(branchId);
  if (!rec) return false;
  if (!sessionId || rec.sessionId !== sessionId) return false;
  branches.delete(branchId);
  const session = sessions.get(rec.sessionId);
  session?.branchIds.delete(branchId);
  return true;
}

/** Test helper — reset in-memory store. */
export function resetBranchSessionStoreForTests(): void {
  sessions.clear();
  branches.clear();
}

/** Test helper — expire branch records immediately and sweep. */
export function expireBranchesForTests(branchIds: string[]): void {
  const expiredAt = now() - 1;
  for (const branchId of branchIds) {
    const rec = branches.get(branchId);
    if (rec) rec.expiresAt = expiredAt;
  }
  sweepExpired();
}
