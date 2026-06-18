export type Handedness = "L" | "R" | "S" | "unknown";
export type HalfInning = "top" | "bottom";

export interface BaseOccupancy {
  first: boolean;
  second: boolean;
  third: boolean;
}

export type PitchCall =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "in_play"
  | "unknown";