interface Props {
  value: number;
  size?: "sm" | "md";
}

export function ExpectedValuePill({ value, size = "md" }: Props) {
  const positive = value >= 0;
  const sign = positive ? "+" : "";
  const classes = positive
    ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/30"
    : "text-red-300 bg-red-500/10 border border-red-500/30";
  const sizeClasses =
    size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span
      className={`inline-block rounded font-mono font-medium ${classes} ${sizeClasses}`}
    >
      {sign}
      {value.toFixed(2)} RE
    </span>
  );
}
