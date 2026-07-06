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
    <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? "bg-emerald-500/20 text-emerald-300"
              : "text-white/50 hover:text-white/80"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
