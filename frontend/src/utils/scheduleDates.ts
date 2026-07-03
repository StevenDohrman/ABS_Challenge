/** Matches backend MLB official-date cutoff (conservative ET offset). */
export function mlbToday(): string {
  const etOffset = -5 * 60;
  const etMs = Date.now() + etOffset * 60 * 1_000;
  return new Date(etMs).toISOString().slice(0, 10);
}

export const SCHEDULE_DAY_COUNT = 7;

export interface ScheduleDateOption {
  /** 0 = today, 6 = six days ago */
  daysAgo: number;
  date: string;
  shortLabel: string;
  longLabel: string;
}

export function mlbDateDaysAgo(daysAgo: number): string {
  const base = new Date(`${mlbToday()}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() - daysAgo);
  return base.toISOString().slice(0, 10);
}

export function buildScheduleDateOptions(): ScheduleDateOption[] {
  return Array.from({ length: SCHEDULE_DAY_COUNT }, (_, daysAgo) => {
    const date = mlbDateDaysAgo(daysAgo);
    return {
      daysAgo,
      date,
      shortLabel: formatShortLabel(daysAgo, date),
      longLabel: formatLongLabel(date),
    };
  });
}

function formatShortLabel(daysAgo: number, date: string): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

function formatLongLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function daysAgoForDate(date: string): number {
  const found = buildScheduleDateOptions().find((o) => o.date === date);
  return found?.daysAgo ?? 0;
}

export function isDateInScheduleWindow(date: string): boolean {
  return buildScheduleDateOptions().some((o) => o.date === date);
}

/** One step older in the 7-day window (wraps today → oldest). */
export function goToOlderDay(daysAgo: number): number {
  return daysAgo >= SCHEDULE_DAY_COUNT - 1 ? 0 : daysAgo + 1;
}

/** One step newer in the 7-day window (wraps oldest → today). */
export function goToNewerDay(daysAgo: number): number {
  return daysAgo <= 0 ? SCHEDULE_DAY_COUNT - 1 : daysAgo - 1;
}

/** Oldest → newest (left to right on the date strip). */
export function buildScheduleDateOptionsOldestFirst(): ScheduleDateOption[] {
  return [...buildScheduleDateOptions()].reverse();
}

export interface ScheduleDateSquareLabel {
  primary: string;
  secondary: string;
}

/** Compact label for a date chip (MLB-style). */
export function formatScheduleDateSquare(
  option: ScheduleDateOption
): ScheduleDateSquareLabel {
  const d = new Date(`${option.date}T12:00:00`);
  return {
    primary: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    secondary: String(d.getDate()),
  };
}
