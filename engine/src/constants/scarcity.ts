export const SCARCITY = {
  /**
   * Teams with at least this many challenges are considered to have "plenty"
   * (their full allotment) — no threshold or confidence penalty is applied.
   */
  PLENTY_MIN_CHALLENGES: 2,

  /**
   * Teams with exactly this many challenges are in "scarce" territory.
   */
  SCARCE_CHALLENGES: 1,

  /** Points added to every recommendation score threshold when moderately scarce. */
  MODERATE_THRESHOLD_SHIFT: 8,

  /** Points added to minimum confidence required when moderately scarce. */
  MODERATE_CONFIDENCE_SHIFT: 5,

  /** Points added to every recommendation score threshold when scarce. */
  SCARCE_THRESHOLD_SHIFT: 14,

  /** Points added to minimum confidence required when scarce. */
  SCARCE_CONFIDENCE_SHIFT: 15,
} as const;
