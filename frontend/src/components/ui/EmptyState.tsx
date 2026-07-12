import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** sm = compact inline panel; md = larger centered block */
  size?: "sm" | "md";
  /** When false, omit the default panel background */
  elevated?: boolean;
}

const SIZE_CLASSES = {
  sm: "rounded-xl px-5 py-6 text-center",
  md: "rounded-2xl px-6 py-10 text-center space-y-2",
};

export function EmptyState({
  title,
  description,
  children,
  className = "",
  size = "sm",
  elevated = true,
}: Props) {
  return (
    <div
      className={`border border-white/10 ${elevated ? "bg-white/3" : ""} ${SIZE_CLASSES[size]} ${className}`}
    >
      <p className={size === "md" ? "text-white/60 font-medium" : "text-sm text-white/40"}>
        {title}
      </p>
      {description && (
        <p className="text-sm text-white/30">{description}</p>
      )}
      {children}
    </div>
  );
}
