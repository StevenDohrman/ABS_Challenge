import { prisma } from "./prisma";
import { fetchPeopleNames } from "@abs/data-pipeline";

export function normalizePlayerName(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isPlaceholderName(playerId: number, name: string): boolean {
  return name === `Player ${playerId}` || name === String(playerId);
}

/** Prefer a real name over an ID placeholder or shorter label. */
export function pickBetterName(
  playerId: number,
  existing: string | null | undefined,
  incoming: string | null | undefined
): string | null {
  const next = normalizePlayerName(incoming);
  if (!next) return normalizePlayerName(existing);

  const prev = normalizePlayerName(existing);
  if (!prev) return next;
  if (isPlaceholderName(playerId, prev) && !isPlaceholderName(playerId, next)) {
    return next;
  }
  if (!isPlaceholderName(playerId, prev) && isPlaceholderName(playerId, next)) {
    return prev;
  }
  return next.length >= prev.length ? next : prev;
}

export async function recordPlayerName(
  playerId: number,
  fullName: string | null | undefined
): Promise<boolean> {
  const clean = normalizePlayerName(fullName);
  if (!clean) return false;

  const existing = await prisma.playerName.findUnique({
    where: { playerId },
    select: { fullName: true },
  });

  const resolved = pickBetterName(playerId, existing?.fullName, clean);
  if (!resolved) return false;
  if (existing?.fullName === resolved) return false;

  await prisma.playerName.upsert({
    where: { playerId },
    create: { playerId, fullName: resolved },
    update: { fullName: resolved },
  });
  return true;
}

export async function recordPlayerNames(
  entries: Array<{ playerId: number; fullName: string | null | undefined }>
): Promise<number> {
  let updated = 0;
  for (const entry of entries) {
    if (await recordPlayerName(entry.playerId, entry.fullName)) {
      updated++;
    }
  }
  return updated;
}

/**
 * Resolve any playerIds not already in the registry directly against the MLB
 * People endpoint (works for any valid player, active or historical, with no
 * playing-time threshold), and persist the result so future lookups skip the
 * network round trip. Failures are swallowed — callers fall back to the
 * `Player <id>` placeholder rather than breaking on a network hiccup.
 */
async function resolveAndCacheMissingNames(
  missingIds: number[]
): Promise<Map<number, string>> {
  const resolved = new Map<number, string>();
  if (missingIds.length === 0) return resolved;

  try {
    const fetched = await fetchPeopleNames(missingIds);
    const entries = Object.entries(fetched).map(([id, fullName]) => ({
      playerId: Number(id),
      fullName,
    }));
    if (entries.length > 0) {
      await recordPlayerNames(entries);
      for (const entry of entries) {
        if (entry.fullName) resolved.set(entry.playerId, entry.fullName);
      }
    }
  } catch (err) {
    console.error(
      `[playerNameRegistry] MLB people lookup failed for ${missingIds.length} id(s):`,
      err
    );
  }

  return resolved;
}

export async function loadPlayerNamesByIds(
  playerIds: number[]
): Promise<Map<number, string>> {
  if (playerIds.length === 0) return new Map();

  const rows = await prisma.playerName.findMany({
    where: { playerId: { in: playerIds } },
    select: { playerId: true, fullName: true },
  });

  const names = new Map(rows.map((r) => [r.playerId, r.fullName]));

  const missingIds = playerIds.filter((id) => !names.has(id));
  if (missingIds.length > 0) {
    const resolved = await resolveAndCacheMissingNames(missingIds);
    for (const [id, fullName] of resolved) {
      names.set(id, fullName);
    }
  }

  return names;
}

export function extractChallengerNameFromPayload(rawPayload: unknown): string | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const reviewDetails = (rawPayload as Record<string, unknown>)["reviewDetails"];
  if (!reviewDetails || typeof reviewDetails !== "object") return null;
  const player = (reviewDetails as Record<string, unknown>)["player"];
  if (!player || typeof player !== "object") return null;
  const fullName = (player as Record<string, unknown>)["fullName"];
  return normalizePlayerName(typeof fullName === "string" ? fullName : null);
}

export function extractChallengerPlayerId(rawPayload: unknown): number | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const reviewDetails = (rawPayload as Record<string, unknown>)["reviewDetails"];
  if (!reviewDetails || typeof reviewDetails !== "object") return null;
  const player = (reviewDetails as Record<string, unknown>)["player"];
  if (!player || typeof player !== "object") return null;
  const id = (player as Record<string, unknown>)["id"];
  if (typeof id === "number") return id;
  if (typeof id === "string") {
    const parsed = parseInt(id, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Record challenger (and batter when known) names from a stored pitch row. */
export async function recordNamesFromPitchRow(row: {
  batterId: number;
  challengerName: string | null;
  rawPayload: unknown;
}): Promise<void> {
  const entries: Array<{ playerId: number; fullName: string | null | undefined }> = [];

  const challengerId = extractChallengerPlayerId(row.rawPayload);
  const challengerName =
    normalizePlayerName(row.challengerName) ??
    extractChallengerNameFromPayload(row.rawPayload);

  if (challengerId !== null && challengerName) {
    entries.push({ playerId: challengerId, fullName: challengerName });
  }

  if (entries.length > 0) {
    await recordPlayerNames(entries);
  }
}

/** Seed registry from historical pitch events and existing stat tables. */
export async function backfillPlayerNamesFromExistingData(): Promise<number> {
  let updated = 0;

  const pitches = await prisma.livePitchEvent.findMany({
    where: {
      OR: [{ challengerName: { not: null } }, { hasReview: true }],
    },
    select: {
      batterId: true,
      challengerName: true,
      rawPayload: true,
    },
  });

  for (const pitch of pitches) {
    const challengerId = extractChallengerPlayerId(pitch.rawPayload);
    const challengerName =
      normalizePlayerName(pitch.challengerName) ??
      extractChallengerNameFromPayload(pitch.rawPayload);
    if (challengerId !== null && challengerName) {
      if (await recordPlayerName(challengerId, challengerName)) updated++;
    }
  }

  const [snapshots, sprays, fielders] = await Promise.all([
    prisma.playerStatSnapshot.findMany({
      select: { playerId: true, playerName: true },
    }),
    prisma.playerSprayProfile.findMany({
      select: { playerId: true, playerName: true },
    }),
    prisma.fielderOaa.findMany({
      select: { playerId: true, playerName: true },
      distinct: ["playerId"],
    }),
  ]);

  for (const row of snapshots) {
    if (await recordPlayerName(row.playerId, row.playerName)) updated++;
  }
  for (const row of sprays) {
    if (await recordPlayerName(row.playerId, row.playerName)) updated++;
  }
  for (const row of fielders) {
    if (await recordPlayerName(row.playerId, row.playerName)) updated++;
  }

  if (updated > 0) {
    console.log(`[playerNameRegistry] backfilled ${updated} player name(s)`);
  }

  return updated;
}
