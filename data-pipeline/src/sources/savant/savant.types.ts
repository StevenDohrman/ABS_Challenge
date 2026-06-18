export interface SavantPitchRow {
  gamePk: number;
  gameDate: string;

  atBatNumber: number;
  pitchNumber: number;

  batterId: number;
  pitcherId: number;

  plateX: number | null;
  plateZ: number | null;
  szTop: number | null;
  szBot: number | null;

  description: string;
  zone: number | null;

  raw: Record<string, string>;
  fetchedAt: string;
}