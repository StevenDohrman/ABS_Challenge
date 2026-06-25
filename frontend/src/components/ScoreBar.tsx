interface Props {
  score: number; // 0–100
}

function barColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 45) return "bg-amber-400";
  return "bg-red-500";
}

export function ScoreBar({ score }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor(score)}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-xs font-mono text-white/50 w-8 text-right">
        {Math.round(score)}
      </span>
    </div>
  );
}
