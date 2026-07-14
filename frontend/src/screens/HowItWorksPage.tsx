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

function StepList({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal list-inside space-y-2 text-sm text-app-secondary leading-relaxed">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
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

export function HowItWorksPage() {
  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">How it works</h1>
        <p className="text-app-secondary leading-relaxed text-sm">
          End-to-end flow from daily ingest through live recommendations,
          postgame audit, rankings, and optional local game branches.
        </p>
      </header>

      <Section title="1. Daily pregame ingest">
        <StepList
          items={[
            "Each morning (or on backend startup), SavantDailyJob fetches season CSV bundles from Baseball Savant.",
            "Batter stat lines, spray profiles, fielder OAA, sprint speed, league averages, and pitcher pitch mix are parsed and stored.",
            "League averages are persisted and hydrated into memory so the engine uses current-season baselines all day.",
            "When a new at-bat starts, the backend loads this context for the batter, pitcher, fielders, runners, and lineup order.",
          ]}
        />
      </Section>

      <Section title="2. Live polling &amp; ingestion">
        <StepList
          items={[
            "LivePollJob discovers active MLB games and polls the live feed on a tiered schedule (15 s in progress, slower pregame/between innings).",
            "Every pitch is deduplicated and stored with game state, count, runners, plate location, and ABS review metadata when present.",
            "At-bat snapshots capture outs, bases, batting order position, defensive alignment, and live batter/pitcher handedness.",
            "The frontend polls game detail endpoints and refreshes the live card, grid, and history while the game is in progress.",
          ]}
        />
      </Section>

      <Section title="3. Recommendation engine">
        <p className="text-sm text-app-secondary leading-relaxed">
          At each new at-bat the backend builds a{" "}
          <code className="text-app-secondary">ChallengeDecisionInput</code> and runs{" "}
          <code className="text-app-secondary">decideChallenge</code> for all 12
          count states. When a called strike arrives, the matching precomputed row
          is surfaced as the live recommendation.
        </p>
        <div className="rounded-2xl border border-app app-surface-subtle px-5 py-4 space-y-4">
          <Term name="Core inputs">
            Inning, outs, count, runners, score, run differential, challenges
            remaining, batter and pitcher profiles, and the current called-strike
            context.
          </Term>
          <Term name="Feature modules">
            Run expectancy and count leverage; player credibility (how likely the
            call was wrong); offensive value; lineup due-up window; defensive
            spray/OAA multiplier; baserunning sprint-speed multiplier when runners
            are on; challenge scarcity; daily league-average baselines.
          </Term>
          <Term name="Output labels">
            AUTO_ALLOW, ALLOW, WARN, or DENY — each with expected run value,
            minimum confidence threshold, and human-readable explanation sentences.
          </Term>
        </div>
        <p className="text-xs text-app-faint leading-relaxed">
          Pitcher challenge hints use the same daily pitch-mix data but are display
          only — they never change the recommendation label.
        </p>
      </Section>

      <Section title="4. Postgame audit">
        <StepList
          items={[
            "When a tracked game goes Final, postgameAuditService runs using pitch location already in live_pitch_events.",
            "Batting: each called strike is compared to MLB zone labels and plate coordinates.",
            "Fielding: each called ball is checked the same way (zone says strike, live call was ball).",
            "If the zone disagrees with the live call, the service computes the raw run-expectancy swing from overturning that call.",
            "A missed opportunity is counted when that swing is positive and no overturn occurred on review.",
            "Bad challenges are flagged when a challenge was used despite DENY or WARN at trigger time.",
            "Results are stored, shown on the game page, and increment player/team rankings.",
          ]}
        />
        <p className="text-xs text-app-faint leading-relaxed mt-2">
          Missed value does not require the live card to have said ALLOW — only
          that the zone-based overturn would have been worth positive run
          expectancy and the team did not get the call reversed.
        </p>
      </Section>

      <Section title="5. Rankings">
        <p className="text-sm text-app-secondary leading-relaxed">
          Visit the{" "}
          <Link to="/rankings" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline">
            rankings page
          </Link>{" "}
          to explore aggregated challenge performance.
        </p>
        <BulletList
          items={[
            "Players — missed RE (batting + fielding split), batting/fielding gained RE, miss count, challenges used, success %.",
            "Teams — batting and fielding missed RE, batting/fielding gained RE, challenges used, success %.",
            "Last 7 days — rolling window aligned with the schedule browser and DB retention.",
            "Season — running totals from program start (set TRACKING_START_DATE on deploy).",
          ]}
        />
        <p className="text-xs text-app-faint leading-relaxed">
          Rankings update incrementally when ABS reviews resolve live and when
          postgame audit completes for a game.
        </p>
      </Section>

      <Section title="6. Game branches (optional)">
        <StepList
          items={[
            "From a game detail page, choose Branch game to snapshot the export bundle into local browser storage — or import JSON on the Branches page.",
            "In the branch editor, enter or update game state: count, outs, runners, score, inning, batter, pitcher, lineups, defense, and challenges remaining.",
            "Each edit triggers a server-side engine preview (same decideChallenge pipeline as live games) and returns a fresh 12-count recommendation grid.",
            "Use play shortcuts to advance the scenario ball-by-ball; recommendations update in real time as your inputs change.",
            "Export JSON or manage saved branches — data stays on your device only and is never written to the tracked-game database.",
          ]}
        />
        <p className="text-xs text-app-faint leading-relaxed mt-2">
          Branches are not limited to replaying a finished game. If you are inputting
          the situation yourself — for example following along pitch-by-pitch without
          MLB tracking — you still get live challenge recommendations and expected run
          values for whatever state you enter.
        </p>
      </Section>

      <Section title="Reading the game page">
        <div className="rounded-2xl border border-app app-surface-subtle px-5 py-4 space-y-4">
          <Term name="Count grid">
            Pre-at-bat recommendations for every balls-strikes combination. Toggle
            visibility from the pre-at-bat banner.
          </Term>
          <Term name="Live card">
            Triggered recommendation for the most recent called strike, including
            expected value and explanation bullets.
          </Term>
          <Term name="Pitcher challenge hints">
            Season Statcast pitch mix with highlighted high ball-rate offerings —
            coaching context for fielding-side challenges.
          </Term>
          <Term name="At-bat history">
            One row per at-bat with triggered count, recommendation badge, zone
            missed indicators after audit, and ABS challenge outcome when a review
            occurred.
          </Term>
          <Term name="Postgame audit summary">
            Per-team missed value, bad-challenge counts, top missed calls, and an
            expandable full audit list with batting vs fielding badges.
          </Term>
          <Term name="Challenge bars">
            Two squares per team showing ABS challenges remaining (of two per team).
          </Term>
        </div>
      </Section>

      <Section title="Recommendation labels">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">AUTO_ALLOW / ALLOW</p>
            <p className="text-xs text-app-muted mt-1 leading-relaxed">
              Strong expected value — challenge is strategically worthwhile if the
              player is confident the call was wrong.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm font-medium text-amber-300">WARN</p>
            <p className="text-xs text-app-muted mt-1 leading-relaxed">
              Borderline value — challenge only with high player confidence.
            </p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm font-medium text-red-300">DENY</p>
            <p className="text-xs text-app-muted mt-1 leading-relaxed">
              Low expected value — preserve the challenge for a better spot.
            </p>
          </div>
          <div className="rounded-xl border border-app app-surface-subtle px-4 py-3">
            <p className="text-sm font-medium text-app-secondary">Postgame only</p>
            <p className="text-xs text-app-muted mt-1 leading-relaxed">
              Fielding-side audits show zone-calculated RE even though live cards
              trigger on batting called strikes.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
