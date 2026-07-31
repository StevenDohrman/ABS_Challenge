import { Link } from "react-router-dom";

const CONTACT_EMAIL = "abschallengecontact@gmail.com";

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

export function ContactPage() {
  return (
    <div className="space-y-8 pb-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Contact</h1>
        <p className="text-app-secondary leading-relaxed">
          Questions about ABS Challenge, feature ideas, or how the rankings and
          audits work — reach out. This is an independent project, not affiliated
          with MLB.
        </p>
      </header>

      <Section title="Email">
        <Card>
          <p className="text-sm text-app-secondary leading-relaxed">
            Prefer a short note with enough context to reply usefully (game date,
            page, or what you were trying to do helps).
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="inline-flex items-center min-h-11 text-sm font-mono text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline underline-offset-2"
          >
            {CONTACT_EMAIL}
          </a>
        </Card>
      </Section>

      <Section title="Good topics">
        <Card>
          <ul className="list-disc list-inside space-y-2 text-sm text-app-secondary leading-relaxed pl-0.5">
            <li>Feature requests or product ideas</li>
            <li>General questions about live guidance, postgame audit, or rankings</li>
            <li>Bugs or unexpected results on a tracked game</li>
            <li>
              Feedback on clarity of the{" "}
              <Link to="/about" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline">
                About
              </Link>
              {" "}or{" "}
              <Link to="/how-it-works" className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-300/90 dark:hover:text-emerald-300 underline">
                How it works
              </Link>
              {" "}pages
            </li>
          </ul>
        </Card>
      </Section>

      <footer className="text-xs text-app-faint font-mono leading-relaxed">
        Replies are best-effort. For how the system works today, start with{" "}
        <Link to="/how-it-works" className="underline hover:text-app-muted">
          How it works
        </Link>
        .
      </footer>
    </div>
  );
}
