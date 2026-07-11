/**
 * Read-only pitcher pitch-mix hints for the game detail UI.
 * Not wired into the challenge engine.
 */

import { SEASONS } from "../db/constants";
import { findPitchMixForPitcher } from "../db/pitcherPitchMixRepository";
import { loadPlayerNamesByIds } from "../db/playerNameRepository";
import type { PitcherPitchMix } from "@prisma/client";

export interface PitcherChallengeHintsPitchDto {
  pitchType: string;
  pitchTypeName: string;
  ballRate: number;
  usageRate: number;
  pitchCount: number;
  highlight: boolean;
}

export interface PitcherChallengeHintsDto {
  pitcherId: number;
  pitcherName?: string;
  season: number;
  summary: string;
  pitches: PitcherChallengeHintsPitchDto[];
}

const HINTS_SUMMARY =
  "If you recognize one of these pitches on a close call, consider challenging more often.";

const PITCH_TYPE_FRIENDLY_NAMES: Record<string, string> = {
  FF: "4-Seam Fastball",
  SI: "Sinker",
  FC: "Cutter",
  SL: "Slider",
  CH: "Changeup",
  CU: "Curveball",
  FS: "Splitter",
  KN: "Knuckleball",
  ST: "Sweeper",
  SV: "Slurve",
  FA: "Fastball",
  EP: "Eephus",
  CS: "Slow Curve",
  SC: "Screwball",
  PO: "Pitchout",
  UN: "Unknown",
};

const MIN_PITCH_COUNT = 30;
const MIN_USAGE_RATE = 0.05;
const HIGH_BALL_RATE = 0.4;
const MAX_HIGHLIGHTS = 4;

export function formatPitchTypeName(
  pitchType: string,
  savantName?: string | null
): string {
  if (savantName && savantName.trim().length > 0) {
    return savantName.trim();
  }
  return PITCH_TYPE_FRIENDLY_NAMES[pitchType] ?? pitchType;
}

export function filterPitchMixRows(rows: PitcherPitchMix[]): PitcherPitchMix[] {
  return rows.filter(
    (row) => row.pitchCount >= MIN_PITCH_COUNT && row.usageRate >= MIN_USAGE_RATE
  );
}

/** Pick highlighted pitch types — top quartile and/or above 40% ball rate. */
export function pickHighlightedPitchTypes(
  pitches: Array<{ pitchType: string; ballRate: number }>
): Set<string> {
  if (pitches.length === 0) return new Set();

  const sorted = [...pitches].sort((a, b) => b.ballRate - a.ballRate);
  const quartileCount = Math.max(1, Math.ceil(sorted.length * 0.25));
  const topQuartile = new Set(
    sorted.slice(0, quartileCount).map((pitch) => pitch.pitchType)
  );

  const highlighted = new Set<string>();
  for (let i = 0; i < Math.min(MAX_HIGHLIGHTS, sorted.length); i++) {
    const pitch = sorted[i];
    if (pitch.ballRate >= HIGH_BALL_RATE || topQuartile.has(pitch.pitchType)) {
      highlighted.add(pitch.pitchType);
    }
  }

  return highlighted;
}

export function buildPitcherChallengeHintsFromRows(
  pitcherId: number,
  season: number,
  rows: PitcherPitchMix[],
  pitcherName?: string
): PitcherChallengeHintsDto | null {
  const filtered = filterPitchMixRows(rows);
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort((a, b) => b.ballRate - a.ballRate);
  const highlighted = pickHighlightedPitchTypes(sorted);

  if (highlighted.size === 0) return null;

  return {
    pitcherId,
    pitcherName,
    season,
    summary: HINTS_SUMMARY,
    pitches: sorted.map((row) => ({
      pitchType: row.pitchType,
      pitchTypeName: formatPitchTypeName(row.pitchType, row.pitchTypeName),
      ballRate: row.ballRate,
      usageRate: row.usageRate,
      pitchCount: row.pitchCount,
      highlight: highlighted.has(row.pitchType),
    })),
  };
}

export async function buildPitcherChallengeHints(
  pitcherId: number,
  season: number = SEASONS.CURRENT
): Promise<PitcherChallengeHintsDto | null> {
  if (!pitcherId) return null;

  const rows = await findPitchMixForPitcher(pitcherId, season);
  if (rows.length === 0) return null;

  const names = await loadPlayerNamesByIds([pitcherId]);
  const pitcherName =
    names.get(pitcherId) ?? rows[0]?.pitcherName ?? undefined;

  return buildPitcherChallengeHintsFromRows(
    pitcherId,
    season,
    rows,
    pitcherName
  );
}
