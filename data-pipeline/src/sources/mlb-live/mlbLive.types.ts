export interface MlbLivePitchEvent {
  gamePk: number;
  playId?: string;
  atBatIndex: number;
  pitchNumber: number;

  inning: number;
  halfInning: "top" | "bottom";

  balls: number;
  strikes: number;
  outs: number;

  batterId: number;
  pitcherId: number;

  callCode?: string;
  callDescription?: string;

  raw: unknown;
  fetchedAt: string;
}