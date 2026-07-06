import { Link } from "react-router-dom";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-mono uppercase tracking-widest text-white/40">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/3 px-5 py-4 space-y-3">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm text-white/60 leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-white/25 shrink-0">›</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-white/80">{name}</p>
      <p className="text-sm text-white/55 leading-relaxed">{children}</p>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">About</h1>
        <p className="text-white/55 leading-relaxed">
          ABS Challenge Advisor helps evaluate MLB Automated Ball-Strike manager
          challenges using run expectancy. It separates{" "}
          <span className="text-white/75">live in-game guidance</span> from{" "}
          <span className="text-white/75">postgame review</span> and rolls both
          into season and weekly{" "}
          <Link to="/rankings" className="text-emerald-300/90 hover:text-emerald-300 underline">
            rankings
          </Link>
          .
        </p>
      </header>

      <Section title="What this app does">
        <Card>
          <p className="text-sm text-white/60 leading-relaxed">
            For tracked games, the system pre-computes challenge value across all
            count states, surfaces a recommendation when a called strike occurs,
            and after the game finishes compares those calls against pitch location
            to find missed opportunities. Everything shown here is decision
            support — not an official zone call or replay ruling.
          </p>
        </Card>
      </Section>

      <Section title="Live game analysis">
        <Card>
          <p className="text-sm text-white/50 leading-relaxed">
            Available while a game is in progress and tracked by the pipeline.
          </p>
          <BulletList
            items={[
              "Pre-at-bat grid — recommendations for all 12 balls-strikes states before the at-bat plays out.",
              "Called-strike card — the triggered recommendation for the latest called strike (ALLOW, WARN, DENY, or AUTO_ALLOW) with expected run value and engine reasons.",
              "At-bat history — in-game log of triggered counts, recommendations, and recorded challenge outcomes.",
              "Challenge counts — remaining challenges per team (two per team under ABS rules).",
            ]}
          />
          <p className="text-xs text-white/35 leading-relaxed border-t border-white/10 pt-3">
            Live recommendations use the MLB live feed and a run-expectancy engine.
            They do not wait on postgame pitch-location enrichment — speed over
            retrospective accuracy.
          </p>
        </Card>
      </Section>

      <Section title="Postgame analysis">
        <Card>
          <p className="text-sm text-white/50 leading-relaxed">
            Runs after a game goes Final. May show as pending while pitch data
            backfills from the archive.
          </p>
          <BulletList
            items={[
              "Each audited called strike is checked against plate-crossing coordinates from the MLB live feed.",
              "Missed opportunities — high-value cases where a challenge was recommended but not used, and the pitch was likely out of zone.",
              "Bad challenges — cases where a challenge was used despite a low-value recommendation.",
              "Total missed value — sum of run expectancy (RE) left on the table across missed high-value chances, including when a team was out of challenges.",
              "Team splits — missed value attributed to the batting team (Top inning = away, Bot = home).",
            ]}
          />
          <p className="text-xs text-white/35 leading-relaxed border-t border-white/10 pt-3">
            Postgame audit is retrospective truth-checking. It does not change what
            was shown live; it evaluates how good the live guidance looks in
            hindsight.
          </p>
        </Card>
      </Section>

      <Section title="Live vs postgame">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-mono uppercase tracking-wider text-red-300/80">
              Live
            </p>
            <ul className="text-sm text-white/60 space-y-1.5 leading-relaxed">
              <li>Real-time during the game</li>
              <li>Pre-bat grid + called-strike trigger</li>
              <li>Run expectancy from game state</li>
              <li>No pitch-location audit yet</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-300/80">
              Postgame
            </p>
            <ul className="text-sm text-white/60 space-y-1.5 leading-relaxed">
              <li>After Final, often a short delay</li>
              <li>Zone check on called strikes</li>
              <li>Missed value and top misses</li>
              <li>Feeds rankings aggregates</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="Rankings">
        <Card>
          <p className="text-sm text-white/60 leading-relaxed">
            The{" "}
            <Link to="/rankings" className="text-emerald-300/90 hover:text-emerald-300 underline">
              rankings page
            </Link>{" "}
            aggregates tracked games across players and teams. Switch between a
            rolling last-7-days window and season-to-date totals. Sort by missed
            value, gained value, or challenge success rate.
          </p>
          <div className="space-y-4 pt-1">
            <Term name="Missed RE">
              Run expectancy left on the table from missed high-value challenges
              (batting side), from postgame audit.
            </Term>
            <Term name="Gained RE">
              Run expectancy captured on successful overturns — split into batting
              and fielding contributions.
            </Term>
            <Term name="Challenge success %">
              Overturned challenges divided by challenges used. Players or teams
              with no challenges show — when sorting by success rate.
            </Term>
          </div>
          <p className="text-xs text-white/35 leading-relaxed border-t border-white/10 pt-3">
            Rankings update as games finish and audits complete. The 7-day view
            matches the schedule browser window; season totals accumulate from
            when the program started tracking games.
          </p>
        </Card>
      </Section>

      <Section title="Limitations">
        <Card>
          <BulletList
            items={[
              "Recommendations are guidance for analysts and fans — not real-time ABS zone rulings.",
              "Only tracked games appear with full live and postgame detail; untracked or backfill-pending games may show partial data.",
              "Postgame zone labels depend on archived pitch location data and the audit rules in use at ingest time.",
            ]}
          />
        </Card>
      </Section>

      <footer className="text-xs text-white/30 font-mono leading-relaxed">
        Data sources: MLB Stats API (schedule, live feed, pitch locations for
        postgame audit). Pregame batter context from Baseball Savant where
        available.
      </footer>
    </div>
  );
}
