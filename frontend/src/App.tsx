import { useState, useEffect } from "react";
import type { ScheduleGame } from "./api/types";
import { fetchHealth } from "./api/client";
import { GamesDashboard } from "./screens/GamesDashboard";
import { GameDetailScreen } from "./screens/GameDetailScreen";

const HEALTH_POLL_MS = 10_000;

export default function App() {
  const [selectedGame, setSelectedGame] = useState<ScheduleGame | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [dbOnline, setDbOnline] = useState(false);

  useEffect(() => {
    async function check() {
      const h = await fetchHealth();
      setServerOnline(h.server);
      setDbOnline(h.db);
    }
    void check();
    const id = setInterval(() => void check(), HEALTH_POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 font-display text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {selectedGame ? (
          <GameDetailScreen
            game={selectedGame}
            onBack={() => setSelectedGame(null)}
          />
        ) : (
          <GamesDashboard
            onSelectGame={setSelectedGame}
            serverOnline={serverOnline}
            dbOnline={dbOnline}
          />
        )}
      </div>
    </div>
  );
}
