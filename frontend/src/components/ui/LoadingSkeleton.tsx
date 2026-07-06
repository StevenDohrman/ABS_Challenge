const SKELETON = "animate-pulse bg-white/5 border border-white/10";

interface CountProps {
  count?: number;
}

export function GameCardSkeletonGrid({ count = 8 }: CountProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-28 rounded-2xl ${SKELETON}`} />
      ))}
    </div>
  );
}

export function GameDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
      <div className={`h-40 rounded-2xl ${SKELETON}`} />
    </div>
  );
}

export function HistoryRowSkeleton({ count = 4 }: CountProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`h-14 rounded-xl ${SKELETON}`} />
      ))}
    </div>
  );
}

export function AuditSummarySkeleton() {
  return (
    <div className={`rounded-2xl px-5 py-6 ${SKELETON}`}>
      <div className="h-4 w-32 bg-white/10 rounded mb-4" />
      <div className="h-8 w-48 bg-white/10 rounded" />
    </div>
  );
}

export function LoadingText({ children }: { children: string }) {
  return <p className="text-sm text-white/40 animate-pulse">{children}</p>;
}
