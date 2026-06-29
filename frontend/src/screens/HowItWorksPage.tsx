export function HowItWorksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">How it works</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-mono uppercase tracking-widest text-white/40">Live pipeline</h2>
        <ol className="list-decimal list-inside space-y-2 text-white/60 text-sm leading-relaxed">
          <li>The backend polls active MLB games and ingests every pitch.</li>
          <li>At each new at-bat, the engine pre-computes recommendations for all 12 count states.</li>
          <li>When a called strike arrives, the matching count recommendation is triggered.</li>
          <li>The frontend shows the live card, count grid, and at-bat history.</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-mono uppercase tracking-widest text-white/40">Postgame audit</h2>
        <ol className="list-decimal list-inside space-y-2 text-white/60 text-sm leading-relaxed">
          <li>After a game goes Final, Savant pitch data is fetched (with retries).</li>
          <li>Called strikes with triggered recommendations are joined to Statcast locations.</li>
          <li>Missed opportunities are flagged when we recommended ALLOW but Savant says ball.</li>
          <li>Total missed value sums expected run value across all missed challenges.</li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-mono uppercase tracking-widest text-white/40">Reading the UI</h2>
        <ul className="list-disc list-inside space-y-2 text-white/60 text-sm leading-relaxed">
          <li><strong className="text-white/80">Count grid</strong> — pre-at-bat recommendations for every balls-strikes state.</li>
          <li><strong className="text-white/80">Live card</strong> — triggered recommendation for the latest called strike.</li>
          <li><strong className="text-white/80">Postgame audit</strong> — top missed calls and total value left on the table.</li>
        </ul>
      </section>
    </div>
  );
}
