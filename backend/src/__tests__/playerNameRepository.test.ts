import {
  extractChallengerPlayerId,
  pickBetterName,
} from "../db/playerNameRepository";

describe("pickBetterName", () => {
  it("prefers a real name over a placeholder", () => {
    expect(pickBetterName(672386, "Player 672386", "Alejandro Kirk")).toBe(
      "Alejandro Kirk"
    );
  });

  it("keeps an existing real name over a placeholder incoming", () => {
    expect(pickBetterName(672386, "Alejandro Kirk", "Player 672386")).toBe(
      "Alejandro Kirk"
    );
  });
});

describe("extractChallengerPlayerId", () => {
  it("reads player id from reviewDetails", () => {
    expect(
      extractChallengerPlayerId({
        reviewDetails: { player: { id: 678882, fullName: "Test Player" } },
      })
    ).toBe(678882);
  });

  it("returns null when reviewDetails missing", () => {
    expect(extractChallengerPlayerId({})).toBeNull();
  });
});
