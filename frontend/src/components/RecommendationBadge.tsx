import type { RecommendationLabel } from "../api/types";

interface Props {
  recommendation: RecommendationLabel;
  size?: "sm" | "md" | "lg";
}

const CONFIG: Record<
  RecommendationLabel,
  { label: string; classes: string; dot: string }
> = {
  AUTO_ALLOW: {
    label: "AUTO ALLOW",
    classes: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  ALLOW: {
    label: "ALLOW",
    classes: "bg-green-500/20 text-green-300 border border-green-500/40",
    dot: "bg-green-400",
  },
  WARN: {
    label: "CAUTION",
    classes: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    dot: "bg-amber-400",
  },
  DENY: {
    label: "DENY",
    classes: "bg-red-500/20 text-red-300 border border-red-500/40",
    dot: "bg-red-400",
  },
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5 gap-1.5",
  md: "text-sm px-3 py-1 gap-2",
  lg: "text-base px-4 py-1.5 gap-2",
};

export function RecommendationBadge({ recommendation, size = "md" }: Props) {
  const { label, classes, dot } = CONFIG[recommendation];
  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium tracking-wider ${classes} ${SIZE_CLASSES[size]}`}
    >
      <span className={`inline-block rounded-full ${dot} ${size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2"}`} />
      {label}
    </span>
  );
}
