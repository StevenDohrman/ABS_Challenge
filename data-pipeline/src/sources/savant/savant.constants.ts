/** HTTP timeouts for Baseball Savant CSV endpoints. */
export const SAVANT_HTTP = {
  /** Leaderboard and single-player CSV endpoints. */
  DEFAULT_TIMEOUT_MS: 60_000,

  /**
   * Full-season Statcast CSV exports — ~17 MB payloads that routinely take
   * 30–40 s even on a good connection; must not share the default budget when
   * fetched alongside other CSVs.
   */
  SEASON_STATCAST_TIMEOUT_MS: 120_000,
} as const;
