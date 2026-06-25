interface Props {
  status: "live" | "waiting" | "offline" | "error";
  label?: string;
}

const CONFIG = {
  live:    { dot: "bg-emerald-400 animate-pulse", text: "text-emerald-400", default: "Live" },
  waiting: { dot: "bg-amber-400",                 text: "text-amber-400",   default: "Waiting" },
  offline: { dot: "bg-slate-500",                 text: "text-slate-500",   default: "Offline" },
  error:   { dot: "bg-red-400",                   text: "text-red-400",     default: "Error" },
};

export function StatusDot({ status, label }: Props) {
  const { dot, text, default: defaultLabel } = CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      <span className={`text-xs font-mono ${text}`}>{label ?? defaultLabel}</span>
    </span>
  );
}
