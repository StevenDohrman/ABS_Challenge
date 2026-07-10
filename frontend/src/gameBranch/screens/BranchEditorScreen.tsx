import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { GameDetailSkeleton } from "../../components/ui/LoadingSkeleton";
import {
  fetchBranch,
  restoreBranchOnServer,
  downloadBranchJson,
  copyBranchToClipboard,
} from "../api/branchClient";
import { BranchHeader } from "../components/BranchHeader";
import { CountStrip } from "../components/CountStrip";
import { DiamondField } from "../components/DiamondField";
import { LineupPanel } from "../components/LineupPanel";
import { DefensePanel } from "../components/DefensePanel";
import { SituationPanel } from "../components/SituationPanel";
import { PlayShortcuts } from "../components/PlayShortcuts";
import { BranchHistoryPanel } from "../components/BranchHistoryPanel";
import { BranchPreviewPanel } from "../components/BranchPreviewPanel";
import {
  branchReducer,
  sideForTeam,
  type BranchDocument,
  type BranchSide,
  type DefensiveLineup,
} from "../state/branchTypes";
import {
  isBlowout,
  validateDefensiveSubstitution,
  validatePinchHit,
  validatePitcherChange,
} from "../rules/substitutions";
import { writeLocalBranch, readLocalBranch } from "../storage/localCache";
import { createBranchSync } from "../storage/sessionSync";
import { validateRunners } from "../rules/runners";
import { applyPlay, type PlayType } from "../rules/plays";

export function BranchEditorScreen() {
  const { gamePk: gamePkParam, branchId: branchIdParam } = useParams<{
    gamePk: string;
    branchId?: string;
  }>();
  const [searchParams] = useSearchParams();
  const scheduleDate = searchParams.get("date") ?? undefined;
  const gamePk = parseInt(gamePkParam ?? "", 10);

  const [branch, dispatch] = useReducer(branchReducer, null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subError, setSubError] = useState<string | null>(null);
  const [playNote, setPlayNote] = useState<string | null>(null);
  const syncRef = useRef<ReturnType<typeof createBranchSync> | null>(null);
  const branchRef = useRef<BranchDocument | null>(null);
  branchRef.current = branch;

  const onPreview = useCallback(
    (grid: NonNullable<BranchDocument["previewGrid"]>, computedAt: string) => {
      dispatch({ type: "SET_PREVIEW_GRID", grid, computedAt });
    },
    []
  );

  const makeSync = useCallback(
    (branchId: string) =>
      createBranchSync(branchId, () => branchRef.current, { onPreview }),
    [onPreview]
  );

  const runnerWarnings = useMemo(
    () => (branch ? validateRunners(branch.situation.runners) : []),
    [branch]
  );

  const syncDoc = useCallback((doc: BranchDocument) => {
    syncRef.current?.queue(doc);
  }, []);

  const loadBranch = useCallback(async () => {
    if (isNaN(gamePk)) {
      setError("Invalid game ID");
      setLoading(false);
      return;
    }

    if (!branchIdParam) {
      setError("Missing branch ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const cached = readLocalBranch(branchIdParam);
    if (cached) dispatch({ type: "LOAD", doc: cached });

    const result = await fetchBranch(branchIdParam);
    if (result.status === "ok") {
      dispatch({ type: "LOAD", doc: result.data });
      writeLocalBranch(result.data);
      syncRef.current = makeSync(result.data.branchId);
      syncRef.current.requestPreview();
      setLoading(false);
      return;
    }
    if (cached) {
      const restored = await restoreBranchOnServer(cached);
      if (restored.status === "ok") {
        dispatch({ type: "LOAD", doc: restored.data });
        writeLocalBranch(restored.data);
        syncRef.current = makeSync(restored.data.branchId);
        syncRef.current.requestPreview();
        setLoading(false);
        return;
      }
      syncRef.current = makeSync(branchIdParam);
      syncRef.current.requestPreview();
      setLoading(false);
      return;
    }
    setError(result.status === "error" ? result.message : "Branch not found");
    setLoading(false);
  }, [gamePk, branchIdParam, makeSync]);

  useEffect(() => {
    void loadBranch();
  }, [loadBranch]);

  useEffect(() => {
    if (branch) writeLocalBranch(branch);
  }, [branch]);

  const applyAndSync = useCallback(
    (action: Parameters<typeof branchReducer>[1]) => {
      const current = branchRef.current;
      if (!current) {
        dispatch(action);
        return;
      }
      const next = branchReducer(current, action);
      dispatch(action);
      if (next) syncDoc(next);
    },
    [syncDoc]
  );

  const showSubError = (message: string) => {
    setSubError(message);
    setPlayNote(null);
  };

  const tryPinchHit = (side: BranchSide, slotIndex: number, benchPlayerId: number) => {
    if (!branch) return;
    const team = branch.teams[side];
    const replaced = team.battingOrder[slotIndex];
    if (!replaced) return;
    const warnings = validatePinchHit(
      team,
      replaced,
      benchPlayerId,
      team.removedFromGame,
      isBlowout(branch.situation)
    );
    const block = warnings.find((w) => w.level === "block");
    if (block) {
      showSubError(block.message);
      return;
    }
    setSubError(null);
    applyAndSync({ type: "SWAP_BENCH_TO_LINEUP", side, slotIndex, benchPlayerId });
  };

  const tryPitcherChange = (side: BranchSide, pitcherId: number) => {
    if (!branch) return;
    const team = branch.teams[side];
    const warnings = validatePitcherChange(
      team,
      pitcherId,
      team.removedFromGame,
      isBlowout(branch.situation)
    );
    const block = warnings.find((w) => w.level === "block");
    if (block) {
      showSubError(block.message);
      return;
    }
    setSubError(null);
    applyAndSync({ type: "CHANGE_PITCHER", side, pitcherId });
  };

  const tryDefenseAssign = (
    side: BranchSide,
    slot: keyof DefensiveLineup,
    playerId: number
  ) => {
    if (!branch) return;
    const team = branch.teams[side];
    const outgoingId = team.defense[slot];
    if (!outgoingId) return;

    const blowout = isBlowout(branch.situation);
    const warnings =
      slot === "pitcher"
        ? validatePitcherChange(team, playerId, team.removedFromGame, blowout)
        : validateDefensiveSubstitution(
            team,
            outgoingId,
            playerId,
            team.removedFromGame,
            blowout
          );
    const block = warnings.find((w) => w.level === "block");
    if (block) {
      showSubError(block.message);
      return;
    }
    setSubError(null);
    applyAndSync({ type: "SET_DEFENSE_SLOT", side, slot, playerId });
  };

  const handleReset = async () => {
    applyAndSync({ type: "RESET_TO_FORK" });
    const result = await syncRef.current?.resetRemote();
    if (result?.status === "ok") {
      dispatch({ type: "LOAD", doc: result.data });
      writeLocalBranch(result.data);
      syncRef.current?.requestPreview();
    }
  };

  if (loading) return <GameDetailSkeleton />;

  if (error && !branch) {
    return (
      <div className="space-y-4">
        <EmptyState title={error} />
        <Link to="/" className="text-sm text-white/40 hover:text-white/80">
          ← All games
        </Link>
      </div>
    );
  }

  if (!branch) return <EmptyState title="Branch unavailable." />;

  const toggleBase = (base: "first" | "second" | "third") => {
    const current = branch.situation.runners[base];
    if (current != null) {
      applyAndSync({ type: "SET_RUNNER", base, playerId: undefined });
    } else {
      applyAndSync({ type: "SET_RUNNER", base, playerId: branch.situation.batterId });
    }
  };

  const onPlay = (play: PlayType) => {
    const result = applyPlay(branch, branch.situation, play);
    setSubError(null);
    setPlayNote(result.description);
    applyAndSync({ type: "APPLY_PLAY", situation: result.situation });
  };

  return (
    <div className="space-y-6">
      <BranchHeader doc={branch} scheduleDate={scheduleDate} />

      {branch.lineupIncomplete && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          Lineups may be incomplete — common during warmup before MLB publishes full batting orders.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <p className="text-xs text-white/35 leading-relaxed">
        Personal sandbox — edits stay in your session unless exported. Engine recommendations
        recompute automatically and are cached locally, never written to the database.
      </p>

      {subError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {subError}
        </p>
      )}

      {playNote && (
        <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
          {playNote}
        </p>
      )}

      <SituationPanel
        doc={branch}
        onBatter={(batterId) =>
          applyAndSync({ type: "PATCH_SITUATION", patch: { batterId } })
        }
        onPitcher={(pitcherId) =>
          tryPitcherChange(sideForTeam(branch, branch.situation.fieldingTeamId), pitcherId)
        }
        onChallenges={(home, away) =>
          applyAndSync({ type: "PATCH_CHALLENGES", home, away })
        }
      />

      <DiamondField runners={branch.situation.runners} onToggleBase={toggleBase} />
      {runnerWarnings.length > 0 && (
        <ul className="text-xs text-amber-300/90 space-y-1">
          {runnerWarnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <CountStrip
        balls={branch.situation.balls}
        strikes={branch.situation.strikes}
        outs={branch.situation.outs}
        onChange={(patch) => applyAndSync({ type: "PATCH_SITUATION", patch })}
      />

      <div className="grid grid-cols-2 gap-3">
        <ScoreStepper
          label="Away"
          value={branch.situation.awayScore}
          onChange={(v) => applyAndSync({ type: "PATCH_SITUATION", patch: { awayScore: v } })}
        />
        <ScoreStepper
          label="Home"
          value={branch.situation.homeScore}
          onChange={(v) => applyAndSync({ type: "PATCH_SITUATION", patch: { homeScore: v } })}
        />
      </div>

      <PlayShortcuts onPlay={onPlay} />

      <div className="grid gap-4 sm:grid-cols-2">
        <LineupPanel
          doc={branch}
          side="away"
          onSwap={(slot, benchId) => tryPinchHit("away", slot, benchId)}
        />
        <LineupPanel
          doc={branch}
          side="home"
          onSwap={(slot, benchId) => tryPinchHit("home", slot, benchId)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DefensePanel
          doc={branch}
          side="away"
          onAssign={(slot, playerId) => tryDefenseAssign("away", slot, playerId)}
        />
        <DefensePanel
          doc={branch}
          side="home"
          onAssign={(slot, playerId) => tryDefenseAssign("home", slot, playerId)}
        />
      </div>

      {branch.previewGrid && (
        <BranchPreviewPanel
          grid={branch.previewGrid}
          computedAt={branch.previewGridComputedAt}
        />
      )}

      <BranchHistoryPanel history={branch.atBatHistory} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleReset()}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Reset to fork
        </button>
        <button
          type="button"
          onClick={() => downloadBranchJson(branch)}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => void copyBranchToClipboard(branch)}
          className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
}

function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
      <span className="text-xs font-mono text-white/40">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-7 w-7 rounded border border-white/15 text-white/60 hover:bg-white/10"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <span className="w-6 text-center font-mono text-lg tabular-nums">{value}</span>
        <button
          type="button"
          className="h-7 w-7 rounded border border-white/15 text-white/60 hover:bg-white/10"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
