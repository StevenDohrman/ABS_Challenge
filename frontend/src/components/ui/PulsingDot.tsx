type DotColor = "emerald" | "amber";
type DotAnimation = "ping" | "pulse";

const COLOR_CLASSES: Record<DotColor, string> = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
};

interface Props {
  color?: DotColor;
  /** ping = live indicator with ripple; pulse = simple opacity pulse */
  animation?: DotAnimation;
  className?: string;
}

export function PulsingDot({
  color = "emerald",
  animation = "ping",
  className = "",
}: Props) {
  const bg = COLOR_CLASSES[color];

  if (animation === "pulse") {
    return (
      <span
        className={`inline-block h-2 w-2 rounded-full ${bg} animate-pulse ${className}`}
      />
    );
  }

  return (
    <span className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bg} opacity-40`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${bg}`} />
    </span>
  );
}
