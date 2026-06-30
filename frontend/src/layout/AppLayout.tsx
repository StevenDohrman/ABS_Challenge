import { Link, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 font-display text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
          <Link to="/" className="text-lg font-bold tracking-tight hover:text-white/90 transition-colors">
            ⚾ ABS Challenge
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/about" className="text-white/40 hover:text-white/80 transition-colors">
              About
            </Link>
            <Link to="/how-it-works" className="text-white/40 hover:text-white/80 transition-colors">
              How it works
            </Link>
          </nav>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
