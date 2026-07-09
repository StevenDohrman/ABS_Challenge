import type { BranchDocument } from "../state/branchTypes";
import { playerLabel, sideForTeam } from "../state/branchTypes";

interface Props {
  doc: BranchDocument;
  onBatter: (id: number) => void;
  onPitcher: (id: number) => void;
  onChallenges: (home: number, away: number) => void;
}

export function SituationPanel({
  doc,
  onBatter,
  onPitcher,
  onChallenges,
}: Props) {
  const sit = doc.situation;
  const battingSide = sideForTeam(doc, sit.battingTeamId);
  const fieldingSide = sideForTeam(doc, sit.fieldingTeamId);
  const battingTeam = doc.teams[battingSide];
  const fieldingTeam = doc.teams[fieldingSide];

  const pitcherOptions = [
    fieldingTeam.defense.pitcher,
    ...fieldingTeam.bullpen,
  ].filter((id, i, a): id is number => id != null && a.indexOf(id) === i);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/4 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white/80">Situation</h3>

      <div className="text-center">
        <span className="font-mono text-sm">
          Inning {sit.inning} {sit.halfInning === "top" ? "▲" : "▼"}
        </span>
        <p className="mt-1 text-[10px] text-white/30">
          Half-innings advance automatically after 3 outs
        </p>
      </div>

      <label className="block text-xs text-white/40">
        Batter
        <select
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
          value={sit.batterId}
          onChange={(e) => onBatter(parseInt(e.target.value, 10))}
        >
          {battingTeam.battingOrder.map((id) => (
            <option key={id} value={id}>
              {playerLabel(doc.playerNames, id)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-white/40">
        Pitcher
        <select
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm"
          value={sit.pitcherId}
          onChange={(e) => onPitcher(parseInt(e.target.value, 10))}
        >
          {pitcherOptions.map((id) => (
            <option key={id} value={id}>
              {playerLabel(doc.playerNames, id)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[10px] text-white/30">
        Pitcher changes must come from the bullpen (re-entry allowed in blowouts only).
      </p>

      <div className="grid grid-cols-2 gap-3">
        <ChallengeStepper
          label="Home ch."
          value={sit.homeChallengesRemaining}
          onChange={(v) => onChallenges(v, sit.awayChallengesRemaining)}
        />
        <ChallengeStepper
          label="Away ch."
          value={sit.awayChallengesRemaining}
          onChange={(v) => onChallenges(sit.homeChallengesRemaining, v)}
        />
      </div>
    </div>
  );
}

function ChallengeStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1.5">
      <span className="text-[10px] text-white/40">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="text-white/50 px-1" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
        <span className="font-mono text-sm w-4 text-center">{value}</span>
        <button type="button" className="text-white/50 px-1" onClick={() => onChange(Math.min(2, value + 1))}>+</button>
      </div>
    </div>
  );
}
