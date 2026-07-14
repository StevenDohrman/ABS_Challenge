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
      className={`border border-app ${elevated ? "app-surface-subtle" : ""} ${SIZE_CLASSES[size]} ${className}`}
    >
      <p className={size === "md" ? "text-app-secondary font-medium" : "text-sm text-app-muted"}>
        {title}
      </p>
      {description && (
        <p className="text-sm text-app-faint">{description}</p>
      )}
      {children}
    </div>
  );
}
