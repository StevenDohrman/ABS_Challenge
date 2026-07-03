export function AboutPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">About</h1>
      <p className="text-white/60 leading-relaxed">
        ABS Challenge Advisor is a strategic recommendation system for MLB&apos;s
        Automated Ball-Strike challenge rules. It ingests live game data, pre-computes
        challenge value for every count state, and triggers recommendations when called
        strikes occur.
      </p>
      <p className="text-white/60 leading-relaxed">
        After games finish, MLB live feed pitch location data is used to evaluate
        missed high-value challenge opportunities. Recommendations are guidance only —
        not real-time zone calls.
      </p>
      <p className="text-xs text-white/30 font-mono">
        Data sources: MLB Live Feed, Baseball Savant (pregame batter stats)
      </p>
    </div>
  );
}
