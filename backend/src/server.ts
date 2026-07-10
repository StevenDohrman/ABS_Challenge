import { app } from "./app";
import { startOrchestrator } from "./orchestrator";
import { assertBranchSecurityConfig } from "./branch/branchSessionConfig";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function main(): Promise<void> {
  assertBranchSecurityConfig();

  process.on("unhandledRejection", (reason) => {
    console.error("[server] unhandled promise rejection:", reason);
  });

  // Listen immediately — orchestrator startup (final backfill, rankings catch-up)
  // can take several minutes and must not block HTTP.
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });

  await startOrchestrator();
}

main().catch((err) => {
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
