import {
  buildPlayerChallengeContext,
  buildDefaultPlayerChallengeContext,
} from "../services/playerContextBuilder";
import { STAT_CONVERSION } from "../db/constants";
import { makePlayerStatSnapshot } from "./fixtures";

// ─────────────────────────────────────────────────────────────────────────────
// buildPlayerChallengeContext
// ─────────────────────────────────────────────────────────────────────────────

describe("buildPlayerChallengeContext", () => {
  describe("playerId passthrough", () => {
    it("copies playerId from the snapshot", () => {
      const snapshot = makePlayerStatSnapshot({ playerId: 99999 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.playerId).toBe(99999);
    });
  });

  describe("percent-to-rate conversion", () => {
    it("converts bbPercent (0–100) to walkRate (0–1) by dividing by 100", () => {
      const snapshot = makePlayerStatSnapshot({ bbPercent: 9.2 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.walkRate).toBeCloseTo(
        9.2 / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR,
        5
      );
    });

    it("converts kPercent (0–100) to strikeoutRate (0–1)", () => {
      const snapshot = makePlayerStatSnapshot({ kPercent: 20.5 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.strikeoutRate).toBeCloseTo(
        20.5 / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR,
        5
      );
    });

    it("converts chasePercent (0–100) to chasePercent (0–1)", () => {
      const snapshot = makePlayerStatSnapshot({ chasePercent: 24.1 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.chasePercent).toBeCloseTo(
        24.1 / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR,
        5
      );
    });

    it("converts whiffPercent (0–100) to whiffPercent (0–1)", () => {
      const snapshot = makePlayerStatSnapshot({ whiffPercent: 22.0 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.whiffPercent).toBeCloseTo(
        22.0 / STAT_CONVERSION.PERCENT_TO_RATE_DIVISOR,
        5
      );
    });

    it("a 0% chase rate converts to a 0.0 rate (perfectly disciplined batter)", () => {
      const snapshot = makePlayerStatSnapshot({ chasePercent: 0 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.chasePercent).toBe(0);
    });

    it("a 100% chase rate converts to 1.0 (completely undisciplined — sanity edge case)", () => {
      const snapshot = makePlayerStatSnapshot({ chasePercent: 100 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.chasePercent).toBe(1);
    });
  });

  describe("null handling", () => {
    it("returns null walkRate when bbPercent is null", () => {
      const snapshot = makePlayerStatSnapshot({ bbPercent: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.walkRate).toBeNull();
    });

    it("returns null strikeoutRate when kPercent is null", () => {
      const snapshot = makePlayerStatSnapshot({ kPercent: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.strikeoutRate).toBeNull();
    });

    it("returns null chasePercent when chasePercent is null", () => {
      const snapshot = makePlayerStatSnapshot({ chasePercent: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.chasePercent).toBeNull();
    });

    it("returns null whiffPercent when whiffPercent is null", () => {
      const snapshot = makePlayerStatSnapshot({ whiffPercent: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.whiffPercent).toBeNull();
    });

    it("passes obp through as-is (no conversion needed)", () => {
      const snapshot = makePlayerStatSnapshot({ obp: 0.355 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.obp).toBe(0.355);
    });

    it("passes ops through as-is (no conversion needed)", () => {
      const snapshot = makePlayerStatSnapshot({ ops: 0.810 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.ops).toBe(0.810);
    });

    it("returns null obp when obp is null", () => {
      const snapshot = makePlayerStatSnapshot({ obp: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.obp).toBeNull();
    });

    it("returns null ops when ops is null", () => {
      const snapshot = makePlayerStatSnapshot({ ops: null });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.ops).toBeNull();
    });
  });

  describe("battingHand narrowing", () => {
    it("maps 'L' to 'L'", () => {
      const ctx = buildPlayerChallengeContext(
        makePlayerStatSnapshot({ battingHand: "L" })
      );
      expect(ctx.battingHand).toBe("L");
    });

    it("maps 'R' to 'R'", () => {
      const ctx = buildPlayerChallengeContext(
        makePlayerStatSnapshot({ battingHand: "R" })
      );
      expect(ctx.battingHand).toBe("R");
    });

    it("maps 'S' (switch hitter) to 'S'", () => {
      const ctx = buildPlayerChallengeContext(
        makePlayerStatSnapshot({ battingHand: "S" })
      );
      expect(ctx.battingHand).toBe("S");
    });

    it("returns null when battingHand is null (not yet enriched from MLB Stats API)", () => {
      const ctx = buildPlayerChallengeContext(
        makePlayerStatSnapshot({ battingHand: null })
      );
      expect(ctx.battingHand).toBeNull();
    });

    it("returns null for an unrecognised battingHand value", () => {
      // Prisma stores battingHand as string | null, so "X" is a valid DB value
      // (e.g. a future MLB handedness code). The builder should guard against it.
      const ctx = buildPlayerChallengeContext(
        makePlayerStatSnapshot({ battingHand: "X" })
      );
      expect(ctx.battingHand).toBeNull();
    });
  });

  describe("historical challenge accuracy passthrough", () => {
    it("copies historicalChallengeAttempts", () => {
      const snapshot = makePlayerStatSnapshot({ historicalChallengeAttempts: 15 });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.historicalChallengeAttempts).toBe(15);
    });

    it("copies historicalChallengeSuccessRate", () => {
      const snapshot = makePlayerStatSnapshot({
        historicalChallengeAttempts: 15,
        historicalChallengeSuccessRate: 0.73,
      });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.historicalChallengeSuccessRate).toBe(0.73);
    });

    it("passes null historicalChallengeSuccessRate through", () => {
      const snapshot = makePlayerStatSnapshot({
        historicalChallengeAttempts: 0,
        historicalChallengeSuccessRate: null,
      });
      const ctx = buildPlayerChallengeContext(snapshot);
      expect(ctx.historicalChallengeSuccessRate).toBeNull();
    });
  });

  describe("spray profile conversion", () => {
    it("sets sprayProfile to null when no profile is passed", () => {
      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}));
      expect(ctx.sprayProfile).toBeNull();
    });

    it("converts spray percentages (0–100) to rates (0–1)", () => {
      const profile = {
        id: 1,
        playerId: 682998,
        playerName: "Wilson, Jacob",
        season: 2026,
        pa: 550,
        pullPercent: 41.2,
        straightawayPercent: 34.8,
        oppoPercent: 24.0,
        gbPercent: 45.1,
        fbPercent: 31.2,
        ldPercent: 23.7,
        fetchedAt: new Date("2026-06-18"),
        updatedAt: new Date("2026-06-18"),
      };

      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}), profile);
      expect(ctx.sprayProfile).not.toBeNull();
      expect(ctx.sprayProfile!.pullPercent).toBeCloseTo(41.2 / 100, 5);
      expect(ctx.sprayProfile!.gbPercent).toBeCloseTo(45.1 / 100, 5);
      expect(ctx.sprayProfile!.ldPercent).toBeCloseTo(23.7 / 100, 5);
    });

    it("sets individual spray fields to null when the profile has nulls", () => {
      const profile = {
        id: 2,
        playerId: 999,
        playerName: "Unknown",
        season: 2026,
        pa: 105,
        pullPercent: null,
        straightawayPercent: null,
        oppoPercent: null,
        gbPercent: null,
        fbPercent: null,
        ldPercent: null,
        fetchedAt: new Date("2026-06-18"),
        updatedAt: new Date("2026-06-18"),
      };

      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}), profile);
      expect(ctx.sprayProfile).not.toBeNull();
      expect(ctx.sprayProfile!.pullPercent).toBeNull();
      expect(ctx.sprayProfile!.gbPercent).toBeNull();
    });
  });

  describe("fielderOaa passthrough", () => {
    it("sets fielderOaa to null by default", () => {
      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}));
      expect(ctx.fielderOaa).toBeNull();
    });

    it("passes a positive OAA value through unchanged", () => {
      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}), null, 12);
      expect(ctx.fielderOaa).toBe(12);
    });

    it("passes a negative OAA value through unchanged", () => {
      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}), null, -8);
      expect(ctx.fielderOaa).toBe(-8);
    });

    it("accepts null explicitly (no fielder data available)", () => {
      const ctx = buildPlayerChallengeContext(makePlayerStatSnapshot({}), null, null);
      expect(ctx.fielderOaa).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildDefaultPlayerChallengeContext
// ─────────────────────────────────────────────────────────────────────────────

describe("buildDefaultPlayerChallengeContext", () => {
  const PLAYER_ID = 999888;
  const ctx = buildDefaultPlayerChallengeContext(PLAYER_ID);

  it("sets the playerId to the supplied ID", () => {
    expect(ctx.playerId).toBe(PLAYER_ID);
  });

  it("sets all nullable offensive fields to null", () => {
    expect(ctx.battingHand).toBeNull();
    expect(ctx.obp).toBeNull();
    expect(ctx.ops).toBeNull();
  });

  it("sets all nullable discipline fields to null", () => {
    expect(ctx.walkRate).toBeNull();
    expect(ctx.strikeoutRate).toBeNull();
    expect(ctx.chasePercent).toBeNull();
    expect(ctx.whiffPercent).toBeNull();
  });

  it("sets historicalChallengeAttempts to 0 (no challenge history yet)", () => {
    expect(ctx.historicalChallengeAttempts).toBe(0);
  });

  it("sets historicalChallengeSuccessRate to null", () => {
    expect(ctx.historicalChallengeSuccessRate).toBeNull();
  });

  it("sets sprayProfile to null (no spray data for default context)", () => {
    expect(ctx.sprayProfile).toBeNull();
  });

  it("sets fielderOaa to null (no fielder data for default context)", () => {
    expect(ctx.fielderOaa).toBeNull();
  });
});
