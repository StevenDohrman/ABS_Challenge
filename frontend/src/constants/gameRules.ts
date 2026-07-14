/**
 * MLB challenge rules — keep in sync with backend GAME_RULES
 * (backend/src/db/constants.ts).
 */
export const GAME_RULES = {
  DEFAULT_CHALLENGES_PER_TEAM: 2,
  LAST_REGULATION_INNING: 9,
  OUTS_PER_HALF_INNING: 3,
} as const;
