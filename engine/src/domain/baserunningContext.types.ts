/**
 * Baserunning context inputs — resolved by the backend before calling the engine.
 */
export interface BaserunningContextInput {
  /**
   * Runner player IDs on each base. Backend correlation metadata — not read by
   * the engine; sprint speeds drive the multiplier calculation.
   */
  runnerIds: {
    first?: number;
    second?: number;
    third?: number;
  };
  batterSprintSpeed: number | null;
  runnerSprintSpeeds: {
    first?: number;
    second?: number;
    third?: number;
  };
}
