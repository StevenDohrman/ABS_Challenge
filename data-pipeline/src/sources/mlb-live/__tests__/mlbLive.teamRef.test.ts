import { resolveGameDataTeam, resolveGameDataTeamIds } from "../mlbLive.teamRef";
import type { MlbLiveFeedResponse } from "../mlbLive.api.types";

describe("resolveGameDataTeam", () => {
  it("reads nested team ref (live in-progress feed shape)", () => {
    const team = resolveGameDataTeam({
      team: { id: 133, name: "Athletics", abbreviation: "ATH" },
    });
    expect(team?.id).toBe(133);
    expect(team?.name).toBe("Athletics");
  });

  it("reads flat team object (final/archived feed shape)", () => {
    const team = resolveGameDataTeam({
      id: 112,
      name: "Chicago Cubs",
      abbreviation: "CHC",
    });
    expect(team?.id).toBe(112);
    expect(team?.abbreviation).toBe("CHC");
  });
});

describe("resolveGameDataTeamIds", () => {
  it("extracts ids from flat final feed gameData.teams", () => {
    const feed = {
      gameData: {
        teams: {
          home: { id: 112, name: "Cubs", abbreviation: "CHC" },
          away: { id: 158, name: "Brewers", abbreviation: "MIL" },
        },
      },
    } as MlbLiveFeedResponse;

    expect(resolveGameDataTeamIds(feed)).toMatchObject({
      homeTeamId: 112,
      awayTeamId: 158,
    });
  });
});
