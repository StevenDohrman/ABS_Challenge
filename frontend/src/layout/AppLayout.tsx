import { Link, Outlet } from "react-router-dom";
import { ThemeToggle } from "../components/ui/ThemeToggle";

const NAV_LINKS = [
  { to: "/branches", label: "Branches" },
  { to: "/rankings", label: "Rankings" },
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How it works" },
] as const;

export function AppLayout() {
  return (
    <div className="min-h-screen app-shell font-display">
      <div className="max-w-2xl mx-auto px-3 py-4 sm:px-4 sm:py-8">
        <header className="mb-5 sm:mb-6 pb-4 border-b border-app">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="text-base sm:text-lg font-bold tracking-tight text-app hover:opacity-90 transition-opacity min-h-11 flex items-center"
            >
              ⚾ ABS Challenge
            </Link>
            <ThemeToggle />
          </div>
          <nav className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-1 -mx-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="app-link text-sm px-3 py-2.5 min-h-11 flex items-center rounded-lg"
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
