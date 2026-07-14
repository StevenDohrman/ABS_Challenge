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
      <h2 className="text-xs font-mono uppercase tracking-widest text-app-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-app app-surface-subtle px-5 py-4 space-y-3">
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-2 text-sm text-app-secondary leading-relaxed pl-0.5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-app">{name}</p>
      <p className="text-sm text-app-secondary leading-relaxed">{children}</p>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">About</h1>
        <p className="text-app-secondary leading-relaxed">
          ABS Challenge Advisor helps evaluate MLB Automated Ball-Strike manager
          challenges using run expectancy. It separates{" "}
          <span className="text-app-secondary">live in-game guidance</span> from{" "}
          <span className="text-app-secondary">postgame review</span> and rolls both
          into season and weekly{" "}
          <Link to="/rankings" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline">
            rankings
          </Link>
          .
        </p>
      </header>

      <Section title="What this app does">
        <Card>
          <p className="text-sm text-app-secondary leading-relaxed">
            For tracked games, the system pre-computes challenge value across all
            12 count states, surfaces a recommendation when a called strike
            occurs, and after the game finishes audits both batting and fielding
            calls against pitch location. Everything shown here is decision
            support — not an official zone call or replay ruling.
          </p>
        </Card>
      </Section>

      <Section title="Schedule &amp; game browser">
        <Card>
          <BulletList
            items={[
              "Home dashboard lists tracked MLB games for today and the prior six days (7-day window).",
              "Each game card shows status, score, inning, and remaining ABS challenges per team.",
              "Open any tracked game for live detail, postgame audit, or to branch into a local sandbox.",
            ]}
          />
        </Card>
      </Section>

      <Section title="Daily pregame context">
        <Card>
          <p className="text-sm text-app-muted leading-relaxed">
            Before first pitch, Baseball Savant season data is ingested once per
            day and reused for every live decision that day.
          </p>
          <BulletList
            items={[
              "Batter stat lines — AVG, OBP, OPS, wOBA, chase rate, whiff rate, and plate discipline.",
              "Spray profiles — pull, straightaway, and opposite-field tendencies plus GB/FB/LD mix.",
              "Fielder OAA — outs above average by position and batter handedness.",
              "Sprint speed — base-running speed for runners on base.",
              "League averages — daily season baselines (chase, walk, K, whiff, OPS, wOBA, batted-ball mix, sprint) injected into the engine.",
              "Pitcher pitch mix — season Statcast usage and ball rates for coaching hints (display only).",
            ]}
          />
        </Card>
      </Section>

      <Section title="Live game analysis">
        <Card>
          <p className="text-sm text-app-muted leading-relaxed">
            Available while a game is in progress and tracked by the pipeline.
          </p>
          <BulletList
            items={[
              "Pre-at-bat grid — recommendations for all 12 balls-strikes states before the at-bat plays out.",
              "Called-strike card — the triggered recommendation for the latest called strike (ALLOW, WARN, DENY, or AUTO_ALLOW) with expected run value and engine reasons.",
              "Pitcher challenge hints — season pitch-mix context highlighting high ball-rate offerings (does not change recommendations).",
              "At-bat history — in-game log of triggered counts, recommendations, and recorded ABS challenge outcomes (challenger, side, overturned).",
              "Challenge counts — remaining challenges per team (two per team under ABS rules).",
            ]}
          />
          <p className="text-xs text-app-faint leading-relaxed border-t border-app pt-3">
            Live recommendations use the MLB live feed plus daily Savant context.
            The engine factors in run expectancy, player credibility, offensive
            value, lineup due-up window, defensive spray/OAA context, baserunning
            speed, challenge scarcity, and daily league baselines. Live guidance
            does not wait on postgame pitch-location audit — speed over
            retrospective accuracy.
          </p>
        </Card>
      </Section>

      <Section title="Postgame analysis">
        <Card>
          <p className="text-sm text-app-muted leading-relaxed">
            Runs shortly after a game goes Final using pitch location already
            stored from the MLB live feed — no Baseball Savant CSV wait.
          </p>
          <BulletList
            items={[
              "Batting audits — called strikes checked against plate-crossing coordinates and MLB zone labels.",
              "Fielding audits — called balls checked the same way (zone says strike, live call was ball).",
              "Missed opportunities — zone disagrees with the live call and overturning would add positive run expectancy, but no successful challenge occurred.",
              "Bad challenges — a challenge was used despite a low-value live recommendation (DENY or WARN).",
              "Total missed value — sum of calculated run-expectancy swing across all missed opportunities, including when a team was out of challenges.",
              "Team splits — missed value attributed by challenging side (batting team for strike misses, fielding team for ball misses).",
            ]}
          />
          <p className="text-xs text-app-faint leading-relaxed border-t border-app pt-3">
            Missed value uses zone-calculated run expectancy, not whether the live
            card said ALLOW. Postgame audit is retrospective truth-checking; it
            does not change what was shown live.
          </p>
        </Card>
      </Section>

      <Section title="Live vs postgame">
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs font-mono uppercase tracking-wider text-red-300/80">
              Live
            </p>
            <ul className="text-sm text-app-secondary space-y-1.5 leading-relaxed">
              <li>Real-time during the game</li>
              <li>Pre-bat grid + called-strike trigger</li>
              <li>Full engine with daily Savant context</li>
              <li>Strategic guidance, not zone audit</li>
            </ul>
          </Card>
          <Card>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-300/80">
              Postgame
            </p>
            <ul className="text-sm text-app-secondary space-y-1.5 leading-relaxed">
              <li>After Final, usually within minutes</li>
              <li>Zone check on batting and fielding calls</li>
              <li>Missed value, bad challenges, top misses</li>
              <li>Feeds rankings aggregates</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section title="Rankings">
        <Card>
          <p className="text-sm text-app-secondary leading-relaxed">
            The{" "}
            <Link to="/rankings" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline">
              rankings page
            </Link>{" "}
            aggregates tracked games across players and teams. Switch between a
            rolling last-7-days window and season-to-date totals. Sort by missed
            value, gained value, or challenge success rate.
          </p>
          <div className="space-y-4 pt-1">
            <Term name="Missed RE">
              Run expectancy left on the table from missed opportunities. For
              players this is batting-side misses; for teams it is batting-side
              missed value only.
            </Term>
            <Term name="Gained RE">
              Run expectancy captured on successful overturns — split into batting
              and fielding contributions on both player and team leaderboards.
            </Term>
            <Term name="Challenge success %">
              Overturned challenges divided by challenges used. Players or teams
              with no challenges show — when sorting by success rate.
            </Term>
          </div>
          <p className="text-xs text-app-faint leading-relaxed border-t border-app pt-3">
            Rankings update as games finish and audits complete. The 7-day view
            matches the schedule browser window; season totals accumulate from
            when the program started tracking games.
          </p>
        </Card>
      </Section>

      <Section title="Game branches">
        <Card>
          <p className="text-sm text-app-secondary leading-relaxed">
            From any game detail page you can{" "}
            <Link to="/branches" className="text-violet-300/90 hover:text-violet-200 underline">
              branch
            </Link>{" "}
            a personal sandbox saved only in your browser — not on the server.
          </p>
          <BulletList
            items={[
              "Fork a live or final game into an editable local copy, or import a branch JSON to build a scenario from scratch.",
              "Enter game state yourself — count, outs, runners, score, inning, batter, pitcher, lineups, defense, and challenge counts.",
              "As you edit the situation, the same recommendation engine runs in real time and returns a fresh 12-count grid for your inputs.",
              "Step through plays (walks, strikeouts, hits, outs) to advance the scenario and see updated challenge guidance.",
              "Export or import branch JSON to share or restore on another session.",
            ]}
          />
          <p className="text-xs text-app-faint leading-relaxed border-t border-app pt-3">
            When you are driving the game state, branches provide real-time decision
            support — not a replay of a tracked MLB feed. Recommendations recompute
            automatically from your edits (cached locally, never written to the database).
            Canonical tracked games on the main game page remain read-only except for live
            polling updates.
          </p>
        </Card>
      </Section>

      <Section title="Limitations">
        <Card>
          <BulletList
            items={[
              "Recommendations are guidance for analysts and fans — not real-time ABS zone rulings.",
              "Only tracked games appear with full live and postgame detail; untracked games may show schedule info only.",
              "Postgame zone labels depend on MLB live feed pitch location and zone metadata at ingest time.",
              "Some engine inputs still use static tables (run-expectancy matrix, count deltas) rather than daily refresh.",
              "Game branches are local to one browser and are not synced across devices.",
            ]}
          />
        </Card>
      </Section>

      <footer className="text-xs text-app-faint font-mono leading-relaxed">
        Data sources: MLB Stats API (schedule, live feed, pitch locations for
        postgame audit). Daily batter, fielder, league, and pitcher context from
        Baseball Savant.
      </footer>
    </div>
  );
}
