interface Props {
  open: boolean;
  className?: string;
}

/** Small CSS chevron for expand/collapse controls (replaces unicode ▶). */
export function DisclosureChevron({ open, className = "" }: Props) {
  return (
    <span
      aria-hidden
      className={`inline-block h-1.5 w-1.5 shrink-0 border-r border-b border-current opacity-40 transition-transform duration-200 ${
        open ? "rotate-[-135deg]" : "rotate-[-45deg]"
      } ${className}`}
    />
  );
}
