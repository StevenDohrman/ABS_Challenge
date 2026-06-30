/** Stable MLB team id → display metadata (2026). */
export interface MlbTeamInfo {
  id: number;
  abbrev: string;
  name: string;
}

const MLB_TEAMS: Record<number, MlbTeamInfo> = {
  108: { id: 108, abbrev: "LAA", name: "Los Angeles Angels" },
  109: { id: 109, abbrev: "AZ", name: "Arizona Diamondbacks" },
  110: { id: 110, abbrev: "BAL", name: "Baltimore Orioles" },
  111: { id: 111, abbrev: "BOS", name: "Boston Red Sox" },
  112: { id: 112, abbrev: "CHC", name: "Chicago Cubs" },
  113: { id: 113, abbrev: "CIN", name: "Cincinnati Reds" },
  114: { id: 114, abbrev: "CLE", name: "Cleveland Guardians" },
  115: { id: 115, abbrev: "COL", name: "Colorado Rockies" },
  116: { id: 116, abbrev: "DET", name: "Detroit Tigers" },
  117: { id: 117, abbrev: "HOU", name: "Houston Astros" },
  118: { id: 118, abbrev: "KC", name: "Kansas City Royals" },
  119: { id: 119, abbrev: "LAD", name: "Los Angeles Dodgers" },
  120: { id: 120, abbrev: "WSH", name: "Washington Nationals" },
  121: { id: 121, abbrev: "NYM", name: "New York Mets" },
  133: { id: 133, abbrev: "OAK", name: "Oakland Athletics" },
  134: { id: 134, abbrev: "PIT", name: "Pittsburgh Pirates" },
  135: { id: 135, abbrev: "SD", name: "San Diego Padres" },
  136: { id: 136, abbrev: "SEA", name: "Seattle Mariners" },
  137: { id: 137, abbrev: "SF", name: "San Francisco Giants" },
  138: { id: 138, abbrev: "STL", name: "St. Louis Cardinals" },
  139: { id: 139, abbrev: "TB", name: "Tampa Bay Rays" },
  140: { id: 140, abbrev: "TEX", name: "Texas Rangers" },
  141: { id: 141, abbrev: "TOR", name: "Toronto Blue Jays" },
  142: { id: 142, abbrev: "MIN", name: "Minnesota Twins" },
  143: { id: 143, abbrev: "PHI", name: "Philadelphia Phillies" },
  144: { id: 144, abbrev: "ATL", name: "Atlanta Braves" },
  145: { id: 145, abbrev: "CWS", name: "Chicago White Sox" },
  146: { id: 146, abbrev: "MIA", name: "Miami Marlins" },
  147: { id: 147, abbrev: "NYY", name: "New York Yankees" },
  158: { id: 158, abbrev: "MIL", name: "Milwaukee Brewers" },
};

export function getTeamInfo(teamId: number): MlbTeamInfo {
  return (
    MLB_TEAMS[teamId] ?? {
      id: teamId,
      abbrev: `T${teamId}`,
      name: `Team ${teamId}`,
    }
  );
}
