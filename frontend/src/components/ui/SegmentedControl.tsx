interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="inline-flex max-w-full flex-wrap rounded-lg border border-app app-surface-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`min-h-11 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
              : "text-app-muted hover:text-app-secondary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
